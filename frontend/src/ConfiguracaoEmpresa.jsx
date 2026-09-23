/** Área independente de clientes/projetos: perfil do negócio e catálogo compartilhado. */
import { useEffect, useRef, useState } from 'react';
import { requisicao } from './api';
import CatalogoEstimativa from './CatalogoEstimativa';
import './Orcamento.css';
import './ConfiguracaoEmpresa.css';

const ramos = [
  ['outros', 'Outros ramos'],
  ['serralheria', 'Serralheria e solda'],
  ['comercio', 'Comércio'],
  ['servicos', 'Prestação de serviços'],
  ['marcenaria', 'Marcenaria'],
];
const exemplosAtividade = {
  marcenaria: 'Ex.: móveis planejados, reformas, fabricação sob medida…',
  serralheria: 'Ex.: portões, grades, solda, estruturas metálicas…',
  comercio: 'Ex.: venda de peças, loja de materiais, comércio local…',
  servicos: 'Ex.: manutenção, instalação, reparos, assistência técnica…',
  outros: 'Ex.: serralheria, comércio, manutenção, instalação, produção sob medida…',
};
const whatsappInicial = { numero: '', waba_id: '', phone_number_id: '', access_token: '', api_version: 'v25.0', ativo: true, configurado: false };
let facebookSdkPromise = null;

function mensagemWhatsApp(erro) {
  // Falhas internas da integração não devem expor códigos ou configurações para quem usa o painel.
  if (/cancelad/i.test(erro?.message || '')) return 'A conexão com o WhatsApp foi cancelada.';
  return 'Não foi possível concluir a conexão com o WhatsApp agora. Tente novamente em alguns minutos ou fale com o suporte.';
}

function obterRedirectUriMeta() {
  // A Meta exige que a URL usada para abrir o OAuth seja idêntica à URL enviada no backend ao trocar o code.
  return `${window.location.origin}/`;
}

function gerarEstadoMeta() {
  // "state" protege o fluxo OAuth: a resposta só vale se voltar com o mesmo identificador gerado aqui.
  const prefixo = `norden-meta-${Date.now()}`;
  if (!window.crypto?.getRandomValues) return `${prefixo}-${Math.random().toString(36).slice(2)}`;
  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);
  return `${prefixo}-${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

function montarUrlOAuthMeta({ appId, configId, apiVersion, redirectUri, state }) {
  // Fallback por URL. O fluxo principal usa FB.login mais abaixo, que é o caminho recomendado para Embedded Signup.
  const params = new URLSearchParams({
    client_id: appId,
    config_id: configId,
    redirect_uri: redirectUri,
    response_type: 'code',
    override_default_response_type: 'true',
    auth_type: 'rerequest',
    display: 'popup',
    state,
    extras: JSON.stringify({
      setup: {},
      featureType: 'whatsapp_business_app_onboarding',
      sessionInfoVersion: '3',
    }),
  });
  return `https://www.facebook.com/${apiVersion || 'v25.0'}/dialog/oauth?${params}`;
}

function opcoesEmbeddedSignupMeta({ configId, state }) {
  // O featureType abaixo é o seletor de coexistência: ele pede à Meta o fluxo para WhatsApp Business App existente.
  return {
    config_id: configId,
    response_type: 'code',
    override_default_response_type: true,
    auth_type: 'rerequest',
    state,
    extras: {
      setup: {},
      featureType: 'whatsapp_business_app_onboarding',
      sessionInfoVersion: '3',
    },
  };
}

function carregarFacebookSdk({ appId, apiVersion }) {
  // Carrega o SDK antes do clique para o popup do FB.login não ser bloqueado pelo navegador.
  if (window.FB?.login) {
    window.FB.init?.({ appId, xfbml: false, version: apiVersion || 'v25.0' });
    return Promise.resolve(window.FB);
  }
  if (facebookSdkPromise) return facebookSdkPromise;
  facebookSdkPromise = new Promise((resolve, reject) => {
    const id = 'facebook-jssdk';
    const anterior = window.fbAsyncInit;
    const falhar = mensagem => {
      facebookSdkPromise = null;
      clearTimeout(timeout);
      reject(new Error(mensagem));
    };
    const timeout = setTimeout(() => falhar('Não foi possível carregar o SDK da Meta.'), 12000);
    window.fbAsyncInit = function fbAsyncInitNorden() {
      try { if (typeof anterior === 'function') anterior(); } catch {}
      try {
        window.FB.init({ appId, xfbml: false, version: apiVersion || 'v25.0' });
        clearTimeout(timeout);
        resolve(window.FB);
      } catch {
        falhar('Não foi possível iniciar o SDK da Meta.');
      }
    };
    if (document.getElementById(id)) {
      setTimeout(() => {
        if (window.FB?.login) {
          clearTimeout(timeout);
          resolve(window.FB);
        } else {
          falhar('Não foi possível carregar o SDK da Meta.');
        }
      }, 2500);
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
    script.onerror = () => falhar('Não foi possível carregar o SDK da Meta.');
    document.body.appendChild(script);
  });
  return facebookSdkPromise;
}

async function loginEmbeddedSignupMeta({ appId, configId, apiVersion, state }) {
  const fb = await carregarFacebookSdk({ appId, apiVersion });
  return new Promise((resolve, reject) => {
    let finalizado = false;
    const timeout = setTimeout(() => {
      if (finalizado) return;
      finalizado = true;
      reject(new Error('A janela da Meta demorou demais para concluir. Tente novamente e finalize o cadastro sem fechar o popup.'));
    }, 120000);
    fb.login(response => {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(timeout);
      const code = response?.authResponse?.code;
      if (code) resolve({ code, origem: 'sdk' });
      else reject(new Error('A Meta não retornou autorização para conectar o WhatsApp.'));
    }, opcoesEmbeddedSignupMeta({ configId, state }));
  });
}

function aguardarOAuthMeta(url, state) {
  // Abre o popup da Meta e resolve apenas quando a página de callback devolve code/state para esta janela.
  return new Promise((resolve, reject) => {
    const largura = 560;
    const altura = 720;
    const esquerda = Math.max(0, Math.round(window.screenX + (window.outerWidth - largura) / 2));
    const topo = Math.max(0, Math.round(window.screenY + (window.outerHeight - altura) / 2));
    const popup = window.open(url, 'norden-meta-whatsapp', `width=${largura},height=${altura},left=${esquerda},top=${topo},resizable=yes,scrollbars=yes,status=yes`);
    if (!popup) {
      reject(new Error('O navegador bloqueou a janela da Meta. Libere pop-ups para a Norden e tente novamente.'));
      return;
    }
    let finalizado = false;
    let intervalo;
    let tempoLimite;
    function concluir(erro, dados) {
      // Finaliza uma única vez, limpa listeners e tenta fechar o popup para não deixar janelas perdidas.
      if (finalizado) return;
      finalizado = true;
      clearInterval(intervalo);
      clearTimeout(tempoLimite);
      window.removeEventListener('message', ouvir);
      try { if (!popup.closed) popup.close(); } catch {}
      if (erro) reject(erro);
      else resolve(dados);
    }
    function ouvir(event) {
      // A callback da própria Norden repassa o resultado; eventos de outros domínios são ignorados.
      if (event.origin !== window.location.origin) return;
      const dados = event.data || {};
      if (dados.type !== 'NORDEN_META_OAUTH' || dados.state !== state) return;
      if (dados.error) concluir(new Error(dados.error_description || dados.error || 'A Meta recusou a conexão.'));
      else if (dados.code) concluir(null, dados);
      else concluir(new Error('A Meta não retornou autorização para conectar o WhatsApp.'));
    }
    window.addEventListener('message', ouvir);
    intervalo = setInterval(() => {
      try {
        if (popup.closed) concluir(new Error('A janela da Meta foi fechada antes de concluir a conexão.'));
      } catch {}
    }, 700);
    tempoLimite = setTimeout(() => concluir(new Error('A janela da Meta demorou demais para concluir. Tente novamente e finalize o cadastro sem fechar o popup.')), 90000);
    try { popup.focus(); } catch {}
  });
}

export default function ConfiguracaoEmpresa({ aoSalvar, podeEditar }) {
  // Estados do perfil da empresa, configuração de WhatsApp e mensagens de retorno de cada formulário.
  const [empresa, setEmpresa] = useState(null);
  const [whatsapp, setWhatsapp] = useState(whatsappInicial);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [erroWhatsApp, setErroWhatsApp] = useState('');
  const [sucessoWhatsApp, setSucessoWhatsApp] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [conectandoMeta, setConectandoMeta] = useState(false);
  const [embeddedMeta, setEmbeddedMeta] = useState({ configurado: false, app_id: '', config_id: '', api_version: 'v25.0' });
  const [tentativa, setTentativa] = useState(0);
  const [ramosPersonalizados, setRamosPersonalizados] = useState([]);
  const embeddedInfoRef = useRef({});
  useEffect(() => {
    // Perfil principal da empresa: nome, ramo, atividade e data de configuração inicial.
    let cancelado = false;
    requisicao('/empresa-configuracao').then(({empresa}) => { if (!cancelado) setEmpresa(empresa); }).catch(e => { if (!cancelado) setErro(e.message); });
    return () => { cancelado = true; };
  }, [tentativa]);
  useEffect(() => {
    // Lista de ramos criados por usuários para sugerir opções em "Outros ramos".
    requisicao('/ramos-personalizados').then(({ ramos }) => setRamosPersonalizados(ramos || [])).catch(() => {});
  }, []);
  useEffect(() => {
    // Configuração já salva do WhatsApp; o token volta vazio para não expor segredo no navegador.
    requisicao('/whatsapp-configuracao').then(({ whatsapp }) => setWhatsapp({ ...whatsappInicial, ...whatsapp, access_token: '' })).catch(() => {});
  }, [tentativa]);
  useEffect(() => {
    // Confere se o Render já recebeu App ID, App Secret e Config ID para habilitar o botão de conexão pela Meta.
    requisicao('/whatsapp-embedded-config').then(config => setEmbeddedMeta(config || {})).catch(() => {});
  }, []);
  useEffect(() => {
    if (!embeddedMeta.configurado) return;
    carregarFacebookSdk({ appId: embeddedMeta.app_id, apiVersion: embeddedMeta.api_version || 'v25.0' }).catch(() => {});
  }, [embeddedMeta]);
  useEffect(() => {
    // Durante o Embedded Signup, a Meta envia WABA ID e Phone Number ID por postMessage antes do OAuth terminar.
    function ouvirMeta(event) {
      try {
        const host = new URL(event.origin).hostname;
        if (!host.endsWith('facebook.com')) return;
        const dados = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (dados?.type === 'WA_EMBEDDED_SIGNUP') {
          const evento = dados.event || '';
          embeddedInfoRef.current = {
            ...embeddedInfoRef.current,
            ...(dados.data || {}),
            evento,
            coexistencia: evento === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' || dados.data?.is_wa_login_user === true,
            erro_meta: evento === 'ERROR' ? dados.data?.error_message || 'A Meta recusou o cadastro do WhatsApp.' : '',
          };
        }
      } catch {}
    }
    window.addEventListener('message', ouvirMeta);
    return () => window.removeEventListener('message', ouvirMeta);
  }, []);
  async function salvar(e) {
    // Salva o perfil visível no painel e avisa o App para atualizar nome/ramo no seletor lateral.
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true); setErro(''); setSucesso('');
    try {
      const resultado = await requisicao('/empresa-configuracao', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(empresa) });
      setEmpresa(resultado.empresa); aoSalvar(resultado.empresa); setSucesso('Empresa configurada. Você já pode preparar os materiais abaixo e iniciar suas conversas.');
    } catch (erro) { setErro(erro.message); } finally { setOcupado(false); }
  }
  async function conectarWhatsAppMeta() {
    // Fluxo facilitado: abre Meta, recebe code, envia code + IDs para o backend e salva tudo na empresa ativa.
    if (conectandoMeta) return;
    setConectandoMeta(true); setErroWhatsApp(''); setSucessoWhatsApp('');
    try {
      if (!embeddedMeta.configurado) throw new Error('A conexão com o WhatsApp ainda está sendo preparada. Tente novamente mais tarde ou fale com o suporte da Norden.');
      embeddedInfoRef.current = {};
      const redirectUri = obterRedirectUriMeta();
      const state = gerarEstadoMeta();
      let resposta;
      try {
        resposta = await loginEmbeddedSignupMeta({
          appId: embeddedMeta.app_id,
          configId: embeddedMeta.config_id,
          apiVersion: embeddedMeta.api_version || 'v25.0',
          state,
        });
      } catch (erroSdk) {
        if (!/SDK da Meta|carregar o SDK|iniciar o SDK/i.test(erroSdk.message || '')) throw erroSdk;
        const urlOAuth = montarUrlOAuthMeta({
          appId: embeddedMeta.app_id,
          configId: embeddedMeta.config_id,
          apiVersion: embeddedMeta.api_version || 'v25.0',
          redirectUri,
          state,
        });
        resposta = { ...(await aguardarOAuthMeta(urlOAuth, state)), origem: 'redirect', redirectUri };
      }
      const code = resposta?.code;
      if (!code) throw new Error('A conexão com a Meta foi cancelada ou não retornou autorização.');
      await new Promise(resolve => setTimeout(resolve, 600));
      const info = embeddedInfoRef.current || {};
      if (info.erro_meta) throw new Error(info.erro_meta);
      const resultado = await requisicao('/whatsapp-embedded-signup', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          code,
          waba_id: info.waba_id,
          phone_number_id: info.phone_number_id,
          business_id: info.business_id,
          coexistencia: Boolean(info.coexistencia),
          redirect_uri: resposta.origem === 'redirect' ? resposta.redirectUri : '',
        }),
      });
      setWhatsapp({ ...whatsappInicial, ...resultado.whatsapp, access_token: '' });
      setSucessoWhatsApp(info.coexistencia ? 'WhatsApp conectado em coexistência. O número pode continuar no WhatsApp Business do celular e também chegar neste painel.' : 'WhatsApp conectado pela Meta. A partir de agora, as mensagens desse número chegam neste painel.');
    } catch (erro) {
      setErroWhatsApp(mensagemWhatsApp(erro));
    } finally {
      setConectandoMeta(false);
    }
  }
  return <section className="configuracao-empresa">
    {/* Cabeçalho explica o objetivo da tela: preparar o negócio antes de receber clientes pelo WhatsApp. */}
    <header><p>SEU NEGÓCIO, DO SEU JEITO</p><h1>Minha empresa</h1><p>Defina com o que você trabalha e deixe seus materiais prontos antes da primeira conversa.</p></header>
    {erro && <p role="alert">{erro}</p>}
    {!empresa && (erro ? <button onClick={() => { setErro(''); setTentativa(v=>v+1); }}>Tentar novamente</button> : <p>Carregando configurações…</p>)}
    {empresa && <>
      {!empresa.configurada_em && <p className="configuracao-boas-vindas">Vamos preparar sua empresa? Revise o ramo de atividade, salve seu perfil e cadastre os materiais que usa. Você pode voltar aqui sempre que precisar.</p>}
      {/* Perfil da empresa: define ramo e exemplos usados depois no catálogo e na coleta da Suzy. */}
      <form onSubmit={salvar}>
        <fieldset disabled={ocupado || !podeEditar}>
          <legend>Perfil da empresa</legend>
          <label>Nome da empresa<input required maxLength={120} value={empresa.nome} onChange={e=>setEmpresa({...empresa,nome:e.target.value})}/></label>
          <label>Ramo de atividade<select value={empresa.segmento} onChange={e=>setEmpresa({...empresa,segmento:e.target.value})}>{ramos.map(([valor,nome])=><option key={valor} value={valor}>{nome}</option>)}</select></label>
          <label>{empresa.segmento === 'outros' ? 'Qual é o ramo da sua empresa?' : 'Com o que você trabalha?'}<input required maxLength={200} list={empresa.segmento === 'outros' ? 'ramos-personalizados-configuracao' : undefined} placeholder={exemplosAtividade[empresa.segmento] || exemplosAtividade.outros} value={empresa.atividade} onChange={e=>setEmpresa({...empresa,atividade:e.target.value})}/></label>
          {empresa.segmento === 'outros' && <><datalist id="ramos-personalizados-configuracao">{ramosPersonalizados.map(r=><option key={r.chave} value={r.nome} />)}</datalist>{ramosPersonalizados.length>0 && <div className="sugestoes-ramos"><span>Já cadastrados:</span>{ramosPersonalizados.slice(0,6).map(r=><button type="button" key={r.chave} onClick={()=>setEmpresa({...empresa,segmento:'outros',atividade:r.nome})}>{r.nome}</button>)}</div>}</>}
          <button type="submit">{ocupado ? 'Salvando…' : 'Salvar perfil da empresa'}</button>
        </fieldset>
        {!podeEditar && <p>Peça ao administrador da empresa para alterar o perfil.</p>}
      </form>
      {sucesso && <p role="status">{sucesso}</p>}
      {/* WhatsApp da empresa: o fluxo oficial da Meta salva os dados necessários sem expor etapas técnicas. */}
      <section>
        <fieldset disabled={conectandoMeta || !podeEditar}>
          <legend>WhatsApp da empresa</legend>
          <p>Conecte o número comercial da empresa para receber as conversas no painel.</p>
          <div className="meta-connect-card">
            <div>
              <strong>Conecte seu WhatsApp</strong>
              <p>Abra a janela oficial, escolha a conta e o número comercial da empresa. A Norden conclui a conexão automaticamente.</p>
              {!embeddedMeta.configurado && <small>A conexão ainda está sendo preparada. Tente novamente mais tarde ou fale com o suporte.</small>}
              {embeddedMeta.configurado && <small>A conexão abre uma janela oficial da Meta. Se o navegador pedir, libere pop-ups para este site.</small>}
            </div>
            <button type="button" onClick={conectarWhatsAppMeta} disabled={conectandoMeta || !podeEditar || !embeddedMeta.configurado}>{conectandoMeta ? 'Conectando…' : 'Conectar WhatsApp'}</button>
          </div>
          {whatsapp.configurado && <p className="nota-whatsapp" role="status">WhatsApp conectado. As novas conversas chegarão neste painel.</p>}
        </fieldset>
        {!podeEditar && <p>Peça ao administrador da empresa para configurar o WhatsApp.</p>}
      </section>
      {erroWhatsApp && <p role="alert">{erroWhatsApp}</p>}
      {sucessoWhatsApp && <p role="status">{sucessoWhatsApp}</p>}
      {/* Catálogo compartilhado da empresa: materiais/preços ficam disponíveis para futuros orçamentos. */}
      <CatalogoEstimativa somenteCatalogo somenteLeitura={!podeEditar} segmento={empresa.segmento} atividade={empresa.atividade} />
    </>}
  </section>;
}
