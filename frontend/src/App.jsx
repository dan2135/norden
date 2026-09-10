/**
 * Escolhe a landing page ou a área autenticada. Na área interna coordena sessão, empresa ativa, painel e conversa da Suzy.
 */
import { useEffect, useRef, useState } from "react";
import { definirCsrf, definirMarcenaria, requisicao } from './api';
import Painel from './Painel';
import TelaLogin from './TelaLogin';
import Rodape from './Rodape';
import LandingPage from './LandingPage';
import BotaoTema from './BotaoTema';
import './Empresa.css';

// Cliente de demonstração já utilizado pelo atendimento local.
const telefone = import.meta.env.VITE_TELEFONE || "119888444445";

function Atendimento({ segmento }) {
  // Estado da conversa exibida; os registros definitivos continuam no backend/banco.
  const [mensagem, setMensagem] = useState("");
  const [conversa, setConversa] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [projetoId, setProjetoId] = useState("");
  const [ocupado, setOcupado] = useState(true);
  const [erro, setErro] = useState("");
  const trava = useRef(false);
  const fim = useRef(null);
  const projetoAtual = projetos.find(p => String(p.id) === projetoId);
  useEffect(() => { fim.current?.scrollIntoView({ block: 'nearest' }); }, [conversa]);

  useEffect(() => {
    let cancelado = false;
    requisicao('/status').then(status => {
      if (status.versao !== 'coleta-v2') throw new Error('O backend está na versão antiga. Reinicie-o com npm.cmd start antes de continuar.');
      return requisicao(`/projetos?telefone=${telefone}`);
    }).then(async ({ projetos: lista }) => {
      if (cancelado) return;
      setProjetos(lista);
      // Com vários projetos, exige escolha para não continuar no móvel errado.
      if (lista.length === 1) {
        const dados = await requisicao(`/projetos/${lista[0].id}/mensagens?telefone=${telefone}`);
        if (cancelado) return;
        setProjetoId(String(lista[0].id));
        setConversa(dados.mensagens);
      }
    }).catch(e => { if (!cancelado) setErro(e.message); })
      .finally(() => { if (!cancelado) setOcupado(false); });
    return () => { cancelado = true; };
  }, []);

  async function executar(acao) {
    if (trava.current || ocupado) return;
    trava.current = true;
    setOcupado(true);
    setErro("");
    try { await acao(); } catch (e) { setErro(e.message); }
    finally { trava.current = false; setOcupado(false); }
  }

  function selecionarProjeto(id) {
    if (mensagem.trim() && !window.confirm('Trocar de projeto e descartar o texto ainda não enviado?')) return;
    if (!id) {
      setProjetoId("");
      setConversa([]);
      setMensagem("");
      return;
    }
    executar(async () => {
      const dados = await requisicao(`/projetos/${id}/mensagens?telefone=${telefone}`);
      setProjetoId(id);
      setConversa(dados.mensagens);
      setMensagem("");
    });
  }

  function novoProjeto() {
    if (mensagem.trim() && !window.confirm('Criar outro projeto e descartar o texto ainda não enviado?')) return;
    executar(async () => {
      const { projeto } = await requisicao("/projetos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone }),
      });
      setProjetos(anterior => [projeto, ...anterior]);
      setProjetoId(String(projeto.id));
      setConversa([]);
      setMensagem("");
    });
  }

  function enviarMensagem(event) {
    event.preventDefault();
    if (!mensagem.trim() || !projetoId) return;
    executar(async () => {
      const textoEnviado = mensagem.trim();
      const dados = await requisicao("/mensagem", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone, mensagem: textoEnviado, projeto_id: Number(projetoId) }),
      });
      setConversa(anterior => [...anterior,
        { remetente: "cliente", texto: textoEnviado },
        { remetente: "sistema", texto: dados.resposta }]);
      setProjetos(anterior => anterior.map(p => p.id === dados.projeto.id ? dados.projeto : p));
      setMensagem("");
    });
  }

  return (
    <div style={styles.pagina}>
      <div style={styles.chat}>
        <div style={styles.cabecalho}>
          <h2>Suzy · Norden</h2>
          <span>{ocupado ? "Aguarde..." : "Assistente virtual"}</span>
        </div>
        <div style={styles.formulario}>
          <label htmlFor="projeto">Projeto</label>
          <select id="projeto" value={projetoId} disabled={ocupado}
            onChange={event => selecionarProjeto(event.target.value)} style={styles.input}>
            <option value="">Selecione um projeto</option>
            {projetos.map(p => (
              <option key={p.id} value={p.id}>
                #{p.id} — {p.coleta?.geral?.solicitacao || p.movel || "Novo projeto"}{p.uso ? ` · ${p.uso}` : ""}
              </option>
            ))}
          </select>
          <button onClick={novoProjeto} disabled={ocupado} style={styles.botao}>Novo projeto</button>
        </div>
        {erro && <div role="alert" style={styles.vazio}>{erro}
          <button disabled={ocupado} onClick={() => window.location.reload()}>Recarregar atendimento</button>
        </div>}
        {projetoAtual && segmento !== 'marcenaria' && <div style={styles.resumo}><strong>Pedido salvo: </strong>{projetoAtual.coleta?.geral?.solicitacao || 'Não informado'}<br />Detalhes: {projetoAtual.coleta?.geral?.detalhes || 'Não informados'}</div>}
        {projetoAtual && segmento === 'marcenaria' && <div style={styles.resumo}>
          <strong>Dados salvos: </strong>{projetoAtual.movel || 'Móvel não informado'} · {projetoAtual.uso || 'Ambiente não informado'}
          <br />Largura: {projetoAtual.largura_cm ?? '—'} cm · Altura: {projetoAtual.altura_cm ?? '—'} cm · Profundidade: {projetoAtual.profundidade_cm ?? '—'} cm
          <br />Acabamento: {projetoAtual.acabamento || '—'} · Detalhes: {projetoAtual.detalhes || '—'}
          {Object.keys(projetoAtual.coleta?.medidas || {}).length > 0 && <p>Há medidas aguardando confirmação de unidade.</p>}
        </div>}
        <div style={styles.mensagens} aria-live="polite" aria-busy={ocupado}>
          {conversa.length === 0 && <p style={styles.vazio}>
            {projetoId ? "Conte o que você precisa neste projeto." : "Selecione um projeto ou clique em Novo projeto para começar."}
          </p>}
          {conversa.map((item, index) => (
            <div key={item.id ?? `nova-${index}`} style={{
              ...styles.balao, ...(item.remetente === "cliente" ? styles.cliente : styles.ia),
            }}>{item.texto}</div>
          ))}
          <div ref={fim} />
        </div>
        <form onSubmit={enviarMensagem} style={styles.formulario}>
          <input value={mensagem} onChange={event => setMensagem(event.target.value)}
            aria-label="Mensagem" placeholder="Digite uma mensagem..." maxLength={10000}
            disabled={ocupado || !projetoId} style={styles.input} />
          <button type="submit" disabled={ocupado || !projetoId || !mensagem.trim()} style={styles.botao}>
            {ocupado ? "Aguarde..." : "Enviar"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  resumo: { padding: '10px 16px', fontSize: '14px', background: 'var(--chat-soft, #f5faf5)', color: 'var(--chat-text, #24402b)', borderBottom: '1px solid var(--chat-soft, #ddd)', overflowWrap: 'anywhere' },
  pagina: {
    minHeight: "100vh",
    background: "var(--chat-bg, #f1f1f1)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Arial",
  },

  chat: {
    width: "min(820px, 100%)",
    height: "min(1050px, 100dvh)",
    background: "var(--chat-surface, white)",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 5px 20px rgba(0,0,0,0.15)",
  },

  cabecalho: {
    padding: "18px",
    background: "#202c33",
    color: "white",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  mensagens: {
    flex: 1,
    minHeight: 0,
    padding: "20px",
    overflowY: "auto",
    background: "var(--chat-bg, #efeae2)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  vazio: {
    textAlign: "center",
    color: "var(--chat-error, #fa0000)",
  },

  balao: {
    color: 'var(--chat-text, #202c33)',
    textAlign: 'left',
    overflowWrap: 'anywhere',
    padding: "10px 14px",
    borderRadius: "10px",
    maxWidth: "75%",
  },

  cliente: {
    alignSelf: "flex-end",
    background: "var(--chat-client, #9cf88c)",
  },

  ia: {
    alignSelf: "flex-start",
    background: "var(--chat-surface, white)",
  },

  formulario: {
    padding: "12px",
    display: "flex",
    gap: "10px",
    background: "var(--chat-soft, #f0f2f5)",
  },

  input: {
    background: 'var(--chat-surface, #fff)',
    color: 'var(--chat-text, #202c33)',
    flex: 1,
    minWidth: 0,
    padding: "12px",
    borderRadius: "20px",
    border: "1px solid #ccc",
    outline: "none",
  },

  botao: {
    background: 'var(--chat-client, #d8e8dc)',
    color: 'var(--chat-text, #202c33)',
    padding: "10px 18px",
    border: "none",
    borderRadius: "20px",
    cursor: "pointer",
  },
};

export default function App() {
  // A página pública não exige sessão; login, cadastro e links de recuperação abrem a aplicação.
  const parametros = new URLSearchParams(window.location.search);
  const acessar = ['login','cadastro','painel'].includes(parametros.get('tela')) || parametros.has('confirmar') || parametros.has('redefinir');
  return acessar ? <><Aplicacao /><BotaoTema flutuante /></> : <LandingPage />;
}

function Aplicacao() {
  // Coordena o usuário autenticado e a empresa ativa; trocar empresa recarrega seu contexto.
  const [versaoClientes, setVersaoClientes] = useState(0);
  useEffect(() => {
    const atualizarClientes = () => setVersaoClientes(v => v + 1);
    window.addEventListener('norden:clientes-alterados', atualizarClientes);
    return () => window.removeEventListener('norden:clientes-alterados', atualizarClientes);
  }, []);
  const [aba, setAba] = useState('painel');
  const [sessao, setSessao] = useState(null);
  const [iniciando, setIniciando] = useState(true);
  const [marcenarias, setMarcenarias] = useState([]);
  const [marcenariaId, setMarcenariaId] = useState('');
  const [erroEmpresa, setErroEmpresa] = useState('');
  const [novaEmpresa, setNovaEmpresa] = useState(null);
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);
  const segmento = marcenarias.find(m=>String(m.id)===marcenariaId)?.segmento || 'marcenaria';
  useEffect(() => {
    requisicao('/auth/sessao').then(entrar)
      .catch(erro => { if (erro.status !== 401) setErroEmpresa(erro.message); })
      .finally(() => setIniciando(false));
  }, []);
  function entrar(dados) {
    definirCsrf(dados.csrf_token);
    setSessao(dados.usuario);
    const lista = dados.marcenarias || [];
      const preferida = localStorage.getItem('marceneiro-ia:marcenaria');
      const escolhida = lista.find(m => String(m.id) === preferida) || lista.find(m => m.slug === 'principal') || lista[0];
      setMarcenarias(lista); if (escolhida) { definirMarcenaria(escolhida.id); setMarcenariaId(String(escolhida.id)); }
    setIniciando(false);
  }
  function trocarMarcenaria(id) {
    definirMarcenaria(id); localStorage.setItem('marceneiro-ia:marcenaria', id); setMarcenariaId(id);
  }
  async function criarMarcenaria(event) {
    event.preventDefault();
    if (salvandoEmpresa) return;
    const nome = novaEmpresa.nome.trim();
    if (!nome) return;
    setSalvandoEmpresa(true); setErroEmpresa('');
    try {
      const { marcenaria } = await requisicao('/marcenarias', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ nome, segmento: novaEmpresa.segmento }) });
      setMarcenarias(lista => [...lista,marcenaria].sort((a,b)=>a.nome.localeCompare(b.nome))); trocarMarcenaria(String(marcenaria.id));
      setNovaEmpresa(null);
    } catch (e) { setErroEmpresa(e.message); } finally { setSalvandoEmpresa(false); }
  }
  async function sair() {
    try { await requisicao('/auth/logout', { method: 'POST' }); } finally {
      definirCsrf(null); definirMarcenaria(null); setSessao(null); setMarcenariaId(''); setMarcenarias([]);
    }
  }
  if (iniciando) return <div className="tela-carregamento"><span>N</span><p>Preparando seu painel…</p></div>;
  if (!sessao) return <TelaLogin onEntrar={entrar} />;
  return <div className="app-shell">
    <aside className="app-navegacao">
      <div className="app-marca"><span>N</span><strong>Norden</strong></div>
      <nav aria-label="Navegação principal">
        <button aria-pressed={aba === 'painel'} onClick={() => setAba('painel')}><span>⌁</span>Painel</button>
        <button aria-pressed={aba === 'atendimento'} onClick={() => setAba('atendimento')}><span>◇</span>Atendimento</button>
      </nav>
      <div className="app-usuario"><span>{sessao.nome?.slice(0,1).toUpperCase()}</span><div><strong>{sessao.nome}</strong><small>{sessao.email}</small></div><button onClick={sair} title="Sair">↪</button></div>
    </aside>
    <section className="app-principal">
      <header className="app-topo"><div><small>ESPAÇO DE TRABALHO</small><strong>{marcenarias.find(m=>String(m.id)===marcenariaId)?.nome || 'Sua empresa'}</strong></div>
        <div className="seletor-marcenaria"><select aria-label="Empresa ativa" value={marcenariaId} disabled={!marcenarias.length} onChange={e=>trocarMarcenaria(e.target.value)}>
          {marcenarias.map(m=><option value={m.id} key={m.id}>{m.nome}</option>)}</select><button onClick={()=>setNovaEmpresa({nome:'',segmento:'outros'})}>+ Nova empresa</button></div>
      </header>
      {novaEmpresa && <form className="nova-empresa" onSubmit={criarMarcenaria}>
        <label>Nome da empresa<input required maxLength={120} value={novaEmpresa.nome} onChange={e=>setNovaEmpresa({...novaEmpresa,nome:e.target.value})} /></label>
        <label>Ramo de atividade<select value={novaEmpresa.segmento} onChange={e=>setNovaEmpresa({...novaEmpresa,segmento:e.target.value})}><option value="outros">Outros ramos</option><option value="comercio">Comércio</option><option value="servicos">Prestação de serviços</option><option value="marcenaria">Marcenaria</option></select></label>
        <button disabled={salvandoEmpresa}>Criar empresa</button><button type="button" disabled={salvandoEmpresa} onClick={()=>setNovaEmpresa(null)}>Cancelar</button>
      </form>}
      {erroEmpresa && <div className="erro-empresa" role="alert">{erroEmpresa}</div>}
      {!marcenariaId && !erroEmpresa && <p className="carregando-empresa">Carregando empresa…</p>}
      {marcenariaId && <div key={marcenariaId} className="app-conteudo">
        <div hidden={aba !== 'painel'}><Painel segmento={segmento} visivel={aba === 'painel'} /></div>
        <div hidden={aba !== 'atendimento'}><Atendimento segmento={segmento} key={versaoClientes} /></div>
      </div>}
      <Rodape />
    </section>
  </div>;
}
