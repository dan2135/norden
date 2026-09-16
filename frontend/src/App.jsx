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
import './Empresa.css';

export default function App() {
  // A página pública não exige sessão; login, cadastro e links de recuperação abrem a aplicação.
  const parametros = new URLSearchParams(window.location.search);
  const acessar = ['login','cadastro','painel'].includes(parametros.get('tela')) || parametros.has('confirmar') || parametros.has('redefinir');
  return acessar ? <><Aplicacao /><BotaoTema flutuante /></> : <LandingPage />;
}

function Aplicacao() {
  // Coordena o usuário autenticado e a empresa ativa; trocar empresa recarrega seu contexto.
  const [aba, setAba] = useState('painel');
  const [sessao, setSessao] = useState(null);
  const [iniciando, setIniciando] = useState(true);
  const [marcenarias, setMarcenarias] = useState([]);
  const [marcenariaId, setMarcenariaId] = useState('');
  const [erroEmpresa, setErroEmpresa] = useState('');
  const [novaEmpresa, setNovaEmpresa] = useState(null);
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);
  const empresaAtiva = marcenarias.find(m=>String(m.id)===marcenariaId);
  const segmento = empresaAtiva?.segmento || 'marcenaria';
  const podeConfigurarEmpresa = ['proprietario','administrador','superadministrador'].includes(empresaAtiva?.papel);
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
  useEffect(() => {
    if (!sessao?.id || sessao?.trocar_senha || !marcenariaId) return;
    let cancelado = false;
    requisicao('/empresa-configuracao')
      .then(({ empresa }) => { if (!cancelado && !empresa.configurada_em) setAba('empresa'); })
      .catch(erro => { if (!cancelado) setErroEmpresa(erro.message); });
    return () => { cancelado = true; };
  }, [sessao?.id, sessao?.trocar_senha, marcenariaId]);
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
  if (sessao.trocar_senha) return <TrocarSenha aoSair={sair} aoConcluir={()=>{definirCsrf(null);definirMarcenaria(null);setSessao(null);setMarcenarias([]);setMarcenariaId('');}} />;
  return <div className="app-shell">
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
      <header className="app-topo"><div><small>ESPAÇO DE TRABALHO</small><strong>{marcenarias.find(m=>String(m.id)===marcenariaId)?.nome || 'Sua empresa'}</strong></div>
        <div className="seletor-marcenaria"><select aria-label="Empresa ativa" value={marcenariaId} disabled={!marcenarias.length} onChange={e=>trocarMarcenaria(e.target.value)}>
          {marcenarias.map(m=><option value={m.id} key={m.id}>{m.nome}</option>)}</select><button onClick={()=>setNovaEmpresa({nome:'',segmento:'outros'})}>+ Nova empresa</button></div>
      </header>
      {novaEmpresa && <form className="nova-empresa" onSubmit={criarMarcenaria}>
        <label>Nome da empresa<input required maxLength={120} value={novaEmpresa.nome} onChange={e=>setNovaEmpresa({...novaEmpresa,nome:e.target.value})} /></label>
        <label>Ramo de atividade<select value={novaEmpresa.segmento} onChange={e=>setNovaEmpresa({...novaEmpresa,segmento:e.target.value})}><option value="outros">Outros ramos</option><option value="serralheria">Serralheria e solda</option><option value="comercio">Comércio</option><option value="servicos">Prestação de serviços</option><option value="marcenaria">Marcenaria</option></select></label>
        <button disabled={salvandoEmpresa}>Criar empresa</button><button type="button" disabled={salvandoEmpresa} onClick={()=>setNovaEmpresa(null)}>Cancelar</button>
      </form>}
      {erroEmpresa && <div className="erro-empresa" role="alert">{erroEmpresa}</div>}
      {!marcenariaId && !erroEmpresa && <p className="carregando-empresa">Carregando empresa…</p>}
      {marcenariaId && <div key={marcenariaId} className="app-conteudo">
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
