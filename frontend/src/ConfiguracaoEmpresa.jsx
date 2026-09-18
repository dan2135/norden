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

function carregarSdkFacebook(appId, apiVersion = 'v25.0') {
  if (!appId) return Promise.reject(new Error('App ID da Meta não configurado no servidor.'));
  return new Promise((resolve, reject) => {
    let resolvido = false;
    const concluir = fn => valor => {
      if (resolvido) return;
      resolvido = true;
      clearTimeout(tempoLimite);
      fn(valor);
    };
    const resolver = concluir(resolve);
    const rejeitar = concluir(reject);
    const tempoLimite = setTimeout(() => rejeitar(new Error('A Meta demorou para carregar. Verifique bloqueador de pop-up/anúncios e recarregue a página.')), 15000);
    const inicializar = () => {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: true,
        version: apiVersion || 'v25.0',
      });
      resolver(window.FB);
    };
    if (window.FB) { inicializar(); return; }
    const existente = document.getElementById('facebook-jssdk');
    window.fbAsyncInit = inicializar;
    if (existente) return;
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => rejeitar(new Error('Não foi possível carregar a janela de conexão da Meta. Verifique bloqueador de pop-up/anúncios.'));
    document.body.appendChild(script);
  });
}

export default function ConfiguracaoEmpresa({ aoSalvar, podeEditar }) {
  const [empresa, setEmpresa] = useState(null);
  const [whatsapp, setWhatsapp] = useState(whatsappInicial);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [erroWhatsApp, setErroWhatsApp] = useState('');
  const [sucessoWhatsApp, setSucessoWhatsApp] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [salvandoWhatsApp, setSalvandoWhatsApp] = useState(false);
  const [conectandoMeta, setConectandoMeta] = useState(false);
  const [sdkMetaPronto, setSdkMetaPronto] = useState(false);
  const [erroSdkMeta, setErroSdkMeta] = useState('');
  const [embeddedMeta, setEmbeddedMeta] = useState({ configurado: false, app_id: '', config_id: '', api_version: 'v25.0' });
  const [tentativa, setTentativa] = useState(0);
  const [ramosPersonalizados, setRamosPersonalizados] = useState([]);
  const embeddedInfoRef = useRef({});
  useEffect(() => {
    let cancelado = false;
    requisicao('/empresa-configuracao').then(({empresa}) => { if (!cancelado) setEmpresa(empresa); }).catch(e => { if (!cancelado) setErro(e.message); });
    return () => { cancelado = true; };
  }, [tentativa]);
  useEffect(() => {
    requisicao('/ramos-personalizados').then(({ ramos }) => setRamosPersonalizados(ramos || [])).catch(() => {});
  }, []);
  useEffect(() => {
    requisicao('/whatsapp-configuracao').then(({ whatsapp }) => setWhatsapp({ ...whatsappInicial, ...whatsapp, access_token: '' })).catch(() => {});
  }, [tentativa]);
  useEffect(() => {
    requisicao('/whatsapp-embedded-config').then(config => setEmbeddedMeta(config || {})).catch(() => {});
  }, []);
  useEffect(() => {
    if (!embeddedMeta.configurado) return;
    let cancelado = false;
    setErroSdkMeta('');
    carregarSdkFacebook(embeddedMeta.app_id, embeddedMeta.api_version || 'v25.0')
      .then(() => { if (!cancelado) setSdkMetaPronto(true); })
      .catch(erro => {
        if (!cancelado) {
          setSdkMetaPronto(false);
          setErroSdkMeta(erro.message);
        }
      });
    return () => { cancelado = true; };
  }, [embeddedMeta.configurado, embeddedMeta.app_id, embeddedMeta.api_version]);
  useEffect(() => {
    function ouvirMeta(event) {
      try {
        const host = new URL(event.origin).hostname;
        if (!host.endsWith('facebook.com')) return;
        const dados = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (dados?.type === 'WA_EMBEDDED_SIGNUP') embeddedInfoRef.current = { ...embeddedInfoRef.current, ...(dados.data || {}) };
      } catch {}
    }
    window.addEventListener('message', ouvirMeta);
    return () => window.removeEventListener('message', ouvirMeta);
  }, []);
  async function salvar(e) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true); setErro(''); setSucesso('');
    try {
      const resultado = await requisicao('/empresa-configuracao', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(empresa) });
      setEmpresa(resultado.empresa); aoSalvar(resultado.empresa); setSucesso('Empresa configurada. Você já pode preparar os materiais abaixo e iniciar suas conversas.');
    } catch (erro) { setErro(erro.message); } finally { setOcupado(false); }
  }
  async function salvarWhatsApp(e) {
    e.preventDefault();
    if (salvandoWhatsApp) return;
    setSalvandoWhatsApp(true); setErroWhatsApp(''); setSucessoWhatsApp('');
    try {
      const resultado = await requisicao('/whatsapp-configuracao', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(whatsapp) });
      setWhatsapp({ ...whatsappInicial, ...resultado.whatsapp, access_token: '' });
      setSucessoWhatsApp('WhatsApp conectado a esta empresa. O webhook vai direcionar as mensagens deste número para este painel.');
    } catch (erro) { setErroWhatsApp(erro.message); } finally { setSalvandoWhatsApp(false); }
  }
  async function conectarWhatsAppMeta() {
    if (conectandoMeta) return;
    setConectandoMeta(true); setErroWhatsApp(''); setSucessoWhatsApp('');
    try {
      if (!embeddedMeta.configurado) throw new Error('Conexão rápida da Meta ainda não configurada no servidor. Configure META_APP_ID, META_APP_SECRET e META_EMBEDDED_SIGNUP_CONFIG_ID no Render.');
      if (!sdkMetaPronto || !window.FB) throw new Error('A janela da Meta ainda não carregou. Aguarde alguns segundos, recarregue a página e tente de novo. Se continuar, desative bloqueador de pop-up/anúncios para este site.');
      embeddedInfoRef.current = {};
      const resposta = await new Promise((resolve, reject) => {
        let retornou = false;
        window.FB.login(r => { retornou = true; resolve(r); }, {
          config_id: embeddedMeta.config_id,
          response_type: 'code',
          override_default_response_type: true,
          scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management',
          extras: {
            setup: {},
            featureType: 'whatsapp_business_app_onboarding',
            sessionInfoVersion: '3',
          },
        });
        setTimeout(() => { if (!retornou) reject(new Error('A janela da Meta não retornou autorização. Tente abrir de novo e conclua o fluxo.')); }, 120000);
      });
      const code = resposta?.authResponse?.code;
      if (!code) throw new Error('A conexão com a Meta foi cancelada ou não retornou autorização.');
      const info = embeddedInfoRef.current || {};
      const resultado = await requisicao('/whatsapp-embedded-signup', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ code, waba_id: info.waba_id, phone_number_id: info.phone_number_id }),
      });
      setWhatsapp({ ...whatsappInicial, ...resultado.whatsapp, access_token: '' });
      setSucessoWhatsApp('WhatsApp conectado pela Meta. A partir de agora, as mensagens desse número chegam neste painel.');
    } catch (erro) {
      setErroWhatsApp(erro.message);
    } finally {
      setConectandoMeta(false);
    }
  }
  const webhookUrl = `${window.location.origin}/api/webhooks/whatsapp`;
  return <section className="configuracao-empresa">
    <header><p>SEU NEGÓCIO, DO SEU JEITO</p><h1>Minha empresa</h1><p>Defina com o que você trabalha e deixe seus materiais prontos antes da primeira conversa.</p></header>
    {erro && <p role="alert">{erro}</p>}
    {!empresa && (erro ? <button onClick={() => { setErro(''); setTentativa(v=>v+1); }}>Tentar novamente</button> : <p>Carregando configurações…</p>)}
    {empresa && <>
      {!empresa.configurada_em && <p className="configuracao-boas-vindas">Vamos preparar sua empresa? Revise o ramo de atividade, salve seu perfil e cadastre os materiais que usa. Você pode voltar aqui sempre que precisar.</p>}
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
      <form onSubmit={salvarWhatsApp}>
        <fieldset disabled={salvandoWhatsApp || conectandoMeta || !podeEditar}>
          <legend>WhatsApp da empresa</legend>
          <p>Conecte o número desta empresa na Meta. O mesmo webhook pode atender várias empresas; a Norden identifica pelo Phone Number ID.</p>
          <div className="meta-connect-card">
            <div>
              <strong>Conectar pelo site</strong>
              <p>Abra a janela oficial da Meta, escolha a conta/WhatsApp da empresa e a Norden salva token, WABA ID e Phone Number ID automaticamente.</p>
              {!embeddedMeta.configurado && <small>Para ativar este botão, configure no Render: <code>META_APP_ID</code>, <code>META_APP_SECRET</code> e <code>META_EMBEDDED_SIGNUP_CONFIG_ID</code>.</small>}
              {embeddedMeta.configurado && !sdkMetaPronto && !erroSdkMeta && <small>Carregando a janela oficial da Meta…</small>}
              {erroSdkMeta && <small>{erroSdkMeta}</small>}
            </div>
            <button type="button" onClick={conectarWhatsAppMeta} disabled={conectandoMeta || salvandoWhatsApp || !podeEditar || !embeddedMeta.configurado || !sdkMetaPronto}>{conectandoMeta ? 'Conectando…' : sdkMetaPronto ? 'Conectar WhatsApp pela Meta' : 'Carregando Meta…'}</button>
          </div>
          <p className="nota-whatsapp">Se precisar, você ainda pode preencher manualmente os campos abaixo.</p>
          <label>Número do WhatsApp<input maxLength={30} placeholder="+55 11 99999-9999" value={whatsapp.numero || ''} onChange={e=>setWhatsapp({...whatsapp,numero:e.target.value})}/></label>
          <label>Phone Number ID<input required inputMode="numeric" maxLength={40} placeholder="ID do número na Meta" value={whatsapp.phone_number_id || ''} onChange={e=>setWhatsapp({...whatsapp,phone_number_id:e.target.value})}/></label>
          <label>WhatsApp Business Account ID<input inputMode="numeric" maxLength={40} placeholder="WABA ID, se tiver" value={whatsapp.waba_id || ''} onChange={e=>setWhatsapp({...whatsapp,waba_id:e.target.value})}/></label>
          <label>Token de acesso da Meta<input type="password" autoComplete="off" maxLength={5000} placeholder={whatsapp.configurado ? 'Token já salvo; preencha só se quiser trocar' : 'Cole o token gerado na Meta'} value={whatsapp.access_token || ''} onChange={e=>setWhatsapp({...whatsapp,access_token:e.target.value})}/></label>
          <label>Versão da API<input required maxLength={10} value={whatsapp.api_version || 'v25.0'} onChange={e=>setWhatsapp({...whatsapp,api_version:e.target.value})}/></label>
          <label className="checkbox-config"><input type="checkbox" checked={whatsapp.ativo !== false} onChange={e=>setWhatsapp({...whatsapp,ativo:e.target.checked})}/> Atendimento ativo neste WhatsApp</label>
          <p className="nota-whatsapp">Webhook na Meta: <code>{webhookUrl}</code>. Token de verificação: <code>norden_whatsapp_2026</code>.</p>
          <button type="submit">{salvandoWhatsApp ? 'Salvando…' : whatsapp.configurado ? 'Atualizar WhatsApp' : 'Salvar WhatsApp'}</button>
        </fieldset>
        {!podeEditar && <p>Peça ao administrador da empresa para configurar o WhatsApp.</p>}
      </form>
      {erroWhatsApp && <p role="alert">{erroWhatsApp}</p>}
      {sucessoWhatsApp && <p role="status">{sucessoWhatsApp}</p>}
      <CatalogoEstimativa somenteCatalogo somenteLeitura={!podeEditar} segmento={empresa.segmento} atividade={empresa.atividade} />
    </>}
  </section>;
}
