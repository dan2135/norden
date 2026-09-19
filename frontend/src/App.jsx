/**
 * Escolhe a landing page ou a área autenticada. Na área interna coordena sessão, empresa ativa, painel e conversa da Suzy.
 */
import { useEffect, useState } from "react";
import { definirCsrf, definirMarcenaria, requisicao } from './api';
import Painel from './Painel';
import TelaLogin from './TelaLogin';
import Rodape from './Rodape';
import LandingPage from './LandingPage';
import BotaoTema from './BotaoTema';
import TrocarSenha from './TrocarSenha';
import ConfiguracaoEmpresa from './ConfiguracaoEmpresa';
import Assinatura from './Assinatura';
import { useTema } from './tema';
import './Empresa.css';

export default function App() {
  // A página pública não exige sessão; login, cadastro e links de recuperação abrem a aplicação.
  const parametros = new URLSearchParams(window.location.search);
  const callbackMeta = parametros.has('code') && parametros.get('state')?.startsWith('norden-meta-');
  if (callbackMeta || parametros.get('tela') === 'meta-callback') return <CallbackMetaOAuth parametros={parametros} />;
  const acessar = ['login','cadastro','painel'].includes(parametros.get('tela')) || parametros.has('confirmar') || parametros.has('redefinir');
  return acessar ? <><Aplicacao /><BotaoTema flutuante /></> : <LandingPage />;
}

function CallbackMetaOAuth({ parametros }) {
  useEffect(() => {
    // A Meta volta para a raiz do site com "code" e "state"; esta tela repassa os dados para o popup que iniciou a conexão.
    const dados = {
      type: 'NORDEN_META_OAUTH',
      code: parametros.get('code') || '',
      state: parametros.get('state') || '',
      error: parametros.get('error') || '',
      error_description: parametros.get('error_description') || parametros.get('error_message') || '',
    };
    if (window.opener) window.opener.postMessage(dados, window.location.origin);
    const timer = setTimeout(() => { if (window.opener) window.close(); }, 1200);
    return () => clearTimeout(timer);
  }, [parametros]);
  const erro = parametros.get('error_description') || parametros.get('error_message') || parametros.get('error');
  return <div className="tela-carregamento"><span>N</span><p>{erro ? `A Meta recusou a conexão: ${erro}` : 'Conexão recebida. Você já pode voltar para a Norden…'}</p></div>;
}

function Aplicacao() {
  // Coordena o usuário autenticado e a empresa ativa; trocar empresa recarrega seu contexto.
  const [temaEscuro] = useTema();
  const [aba, setAba] = useState('painel');
  const [sessao, setSessao] = useState(null);
  const [iniciando, setIniciando] = useState(true);
  const [marcenarias, setMarcenarias] = useState([]);
  const [marcenariaId, setMarcenariaId] = useState('');
  const [erroEmpresa, setErroEmpresa] = useState('');
  const [novaEmpresa, setNovaEmpresa] = useState(null);
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);
  const [ramosPersonalizados, setRamosPersonalizados] = useState([]);
  const empresaAtiva = marcenarias.find(m=>String(m.id)===marcenariaId);
  const segmento = empresaAtiva?.segmento || 'marcenaria';
  const podeConfigurarEmpresa = ['proprietario','administrador','superadministrador'].includes(empresaAtiva?.papel);
  useEffect(() => {
    // Ao abrir o app interno, tenta reaproveitar a sessão do cookie antes de mostrar login.
    requisicao('/auth/sessao').then(entrar)
      .catch(erro => { if (erro.status !== 401) setErroEmpresa(erro.message); })
      .finally(() => setIniciando(false));
  }, []);
  useEffect(() => {
    // Ramos personalizados alimentam as sugestões quando o usuário cria empresas fora dos modelos prontos.
    requisicao('/ramos-personalizados').then(({ ramos }) => setRamosPersonalizados(ramos || [])).catch(() => {});
  }, []);
  function entrar(dados) {
    // Depois do login, registra CSRF e escolhe a última empresa usada para manter o contexto do painel.
    definirCsrf(dados.csrf_token);
    setSessao(dados.usuario);
    const lista = dados.marcenarias || [];
      const preferida = localStorage.getItem('marceneiro-ia:marcenaria');
      const escolhida = lista.find(m => String(m.id) === preferida) || lista.find(m => m.slug === 'principal') || lista[0];
      setMarcenarias(lista); if (escolhida) { definirMarcenaria(escolhida.id); setMarcenariaId(String(escolhida.id)); }
    setIniciando(false);
  }
  function trocarMarcenaria(id) {
    // Trocar empresa muda o cabeçalho das próximas chamadas e força cada aba a ler seus próprios dados.
    definirMarcenaria(id); localStorage.setItem('marceneiro-ia:marcenaria', id); setMarcenariaId(id);
  }
  useEffect(() => {
    // Primeiro acesso cai direto em "Minha empresa" para completar ramo, materiais e WhatsApp.
    if (!sessao?.id || sessao?.trocar_senha || !marcenariaId) return;
    let cancelado = false;
    requisicao('/empresa-configuracao')
      .then(({ empresa }) => { if (!cancelado && !empresa.configurada_em) setAba('empresa'); })
      .catch(erro => { if (!cancelado) setErroEmpresa(erro.message); });
    return () => { cancelado = true; };
  }, [sessao?.id, sessao?.trocar_senha, marcenariaId]);
  async function criarMarcenaria(event) {
    // Cria outra empresa para o mesmo usuário; o backend valida acesso e evita nomes/slug duplicados.
    event.preventDefault();
    if (salvandoEmpresa) return;
    const nome = novaEmpresa.nome.trim();
    if (!nome) return;
    const atividade = novaEmpresa.atividade?.trim() || '';
    if (novaEmpresa.segmento === 'outros' && !atividade) { setErroEmpresa('Informe o ramo da empresa.'); return; }
    setSalvandoEmpresa(true); setErroEmpresa('');
    try {
      const { marcenaria } = await requisicao('/marcenarias', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ nome, segmento: novaEmpresa.segmento, atividade }) });
      setMarcenarias(lista => [...lista,marcenaria].sort((a,b)=>a.nome.localeCompare(b.nome))); trocarMarcenaria(String(marcenaria.id));
      setNovaEmpresa(null);
    } catch (e) { setErroEmpresa(e.message); } finally { setSalvandoEmpresa(false); }
  }
  async function sair() {
    // Logout limpa tanto a sessão do servidor quanto o contexto local usado nas requisições.
    try { await requisicao('/auth/logout', { method: 'POST' }); } finally {
      definirCsrf(null); definirMarcenaria(null); setSessao(null); setMarcenariaId(''); setMarcenarias([]);
    }
  }
  if (iniciando) return <div className="tela-carregamento"><span>N</span><p>Preparando seu painel…</p></div>;
  if (!sessao) return <TelaLogin onEntrar={entrar} />;
  if (sessao.trocar_senha) return <TrocarSenha aoSair={sair} aoConcluir={()=>{definirCsrf(null);definirMarcenaria(null);setSessao(null);setMarcenarias([]);setMarcenariaId('');}} />;
  return <div className="app-shell" data-theme={temaEscuro ? 'dark' : 'light'}>
    {/* Navegação lateral fixa: troca abas sem recarregar a sessão nem perder a empresa ativa. */}
    <aside className="app-navegacao">
      <div className="app-marca"><span>N</span><strong>Norden</strong></div>
      <nav aria-label="Navegação principal">
        <button aria-pressed={aba === 'painel'} onClick={() => setAba('painel')}><span>⌁</span>Painel</button>
        <button aria-pressed={aba === 'empresa'} onClick={() => setAba('empresa')}><span>▣</span>Minha empresa</button>
        <button aria-pressed={aba === 'plano'} onClick={() => setAba('plano')}><span>◌</span>Meu plano</button>
      </nav>
      <div className="app-usuario"><span>{sessao.nome?.slice(0,1).toUpperCase()}</span><div><strong>{sessao.nome}</strong><small>{sessao.email}</small></div><button onClick={sair} title="Sair">↪</button></div>
    </aside>
    <section className="app-principal">
      {/* Topo da área interna: mostra a empresa atual e permite criar/alternar empresas. */}
      <header className="app-topo"><div><small>ESPAÇO DE TRABALHO</small><strong>{marcenarias.find(m=>String(m.id)===marcenariaId)?.nome || 'Sua empresa'}</strong></div>
        <div className="seletor-marcenaria"><select aria-label="Empresa ativa" value={marcenariaId} disabled={!marcenarias.length} onChange={e=>trocarMarcenaria(e.target.value)}>
          {marcenarias.map(m=><option value={m.id} key={m.id}>{m.nome}</option>)}</select><button onClick={()=>setNovaEmpresa({nome:'',segmento:'outros',atividade:''})}>+ Nova empresa</button></div>
      </header>
      {novaEmpresa && <form className="nova-empresa" onSubmit={criarMarcenaria}>
        <label>Nome da empresa<input required maxLength={120} value={novaEmpresa.nome} onChange={e=>setNovaEmpresa({...novaEmpresa,nome:e.target.value})} /></label>
        <label>Ramo de atividade<select value={novaEmpresa.segmento} onChange={e=>setNovaEmpresa({...novaEmpresa,segmento:e.target.value,atividade:e.target.value==='outros'?novaEmpresa.atividade:''})}><option value="outros">Outros ramos</option><option value="serralheria">Serralheria e solda</option><option value="comercio">Comércio</option><option value="servicos">Prestação de serviços</option><option value="marcenaria">Marcenaria</option></select></label>
        {novaEmpresa.segmento === 'outros' && <><label>Qual é o ramo da empresa?<input required maxLength={200} list="ramos-personalizados-painel" value={novaEmpresa.atividade} onChange={e=>setNovaEmpresa({...novaEmpresa,atividade:e.target.value})} placeholder="Ex.: vidraçaria, estética automotiva, costura…" /></label><datalist id="ramos-personalizados-painel">{ramosPersonalizados.map(r=><option key={r.chave} value={r.nome} />)}</datalist>{ramosPersonalizados.length>0 && <div className="sugestoes-ramos"><span>Já cadastrados:</span>{ramosPersonalizados.slice(0,6).map(r=><button type="button" key={r.chave} onClick={()=>setNovaEmpresa({...novaEmpresa,segmento:'outros',atividade:r.nome})}>{r.nome}</button>)}</div>}</>}
        <button disabled={salvandoEmpresa}>Criar empresa</button><button type="button" disabled={salvandoEmpresa} onClick={()=>setNovaEmpresa(null)}>Cancelar</button>
      </form>}
      {erroEmpresa && <div className="erro-empresa" role="alert">{erroEmpresa}</div>}
      {!marcenariaId && !erroEmpresa && <p className="carregando-empresa">Carregando empresa…</p>}
      {marcenariaId && <div key={marcenariaId} className="app-conteudo">
        {/* Cada aba é montada só quando necessária; isso evita chamadas desnecessárias e mantém o painel leve. */}
        <div hidden={aba !== 'painel'}><Painel segmento={segmento} visivel={aba === 'painel'} /></div>
        <div hidden={aba !== 'empresa'}>
          {aba === 'empresa' && <ConfiguracaoEmpresa
            podeEditar={podeConfigurarEmpresa}
            aoSalvar={empresa => {
              setErroEmpresa('');
              setMarcenarias(lista => lista.map(item => String(item.id) === String(empresa.id) ? { ...item, ...empresa } : item));
            }}
          />}
        </div>
        <div hidden={aba !== 'plano'}>{aba === 'plano' && <Assinatura podeEditar={podeConfigurarEmpresa} />}</div>
      </div>}
      <Rodape />
    </section>
  </div>;
}
