import { useEffect, useRef, useState } from 'react';
import { requisicao } from './api';
import './ContasUsuarios.css';

export default function ContasUsuarios({ aoExcluirConta }) {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('');
  const [pagina, setPagina] = useState(1);
  const [versao, setVersao] = useState(0);
  const [estado, setEstado] = useState({ carregando: true, usuarios: [], erro: '' });
  const [alvo, setAlvo] = useState(null);
  const [mensagem, setMensagem] = useState('');
  useEffect(() => {
    let ativo = true;
    requisicao(`/admin/usuarios?busca=${encodeURIComponent(filtro)}&pagina=${pagina}`)
      .then(d => { if (ativo) setEstado({ ...d, carregando: false, erro: '' }); })
      .catch(e => { if (ativo) setEstado({ usuarios: [], carregando: false, erro: e.message }); });
    return () => { ativo = false; };
  }, [filtro, pagina, versao]);
  function atualizar() {
    setEstado(s => ({ ...s, carregando: true, erro: '' }));
    setVersao(v => v + 1);
  }
  return <section className="contas-usuarios">
    <h1>Contas de usuários</h1>
    <p>Exclusão definitiva de acesso, disponível somente ao administrador geral.</p>
    <form className="contas-busca" onSubmit={e => { e.preventDefault(); setFiltro(busca); setPagina(1); atualizar(); }}>
      <label>Buscar por nome ou e-mail<input value={busca} onChange={e => setBusca(e.target.value)} maxLength={120} type="search" /></label>
      <button disabled={estado.carregando}>Buscar</button>
    </form>
    {mensagem && <p role="status">{mensagem}</p>}
    {estado.erro && <p role="alert">{estado.erro} <button onClick={atualizar}>Tentar novamente</button></p>}
    {estado.carregando ? <p role="status">Carregando contas…</p> : <>
      {!estado.usuarios.length && !estado.erro && <p>Nenhuma conta encontrada.</p>}
      <ul>{estado.usuarios.map(usuario => <li key={usuario.id}>
        <div><strong>{usuario.nome}</strong><span>{usuario.email}</span><small>{usuario.superadministrador ? 'Administrador geral · conta protegida' : usuario.email_confirmado ? 'E-mail confirmado' : 'Aguardando confirmação do e-mail'}</small></div>
        {!usuario.superadministrador && <button className="botao-excluir-cliente" onClick={() => { setAlvo(usuario); setMensagem(''); }}>Apagar conta</button>}
      </li>)}</ul>
      <div className="contas-paginacao"><button disabled={pagina === 1} onClick={() => { setPagina(p => p - 1); atualizar(); }}>Anterior</button><span>Página {pagina}</span><button disabled={!estado.proxima_pagina} onClick={() => { setPagina(p => p + 1); atualizar(); }}>Próxima</button></div>
    </>}
    {alvo && <ExcluirConta usuario={alvo} aoFechar={() => setAlvo(null)} aoExcluir={texto => { setAlvo(null); setMensagem(texto); atualizar(); aoExcluirConta?.(); }} />}
  </section>;
}

function ExcluirConta({ usuario, aoFechar, aoExcluir }) {
  const dialogo = useRef(null);
  const trava = useRef(false);
  const [senha, setSenha] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => { const d = dialogo.current; d.showModal(); return () => d.close(); }, []);
  async function excluir(e) {
    e.preventDefault();
    if (trava.current) return;
    trava.current = true; setOcupado(true); setErro('');
    try {
      const d = await requisicao(`/admin/usuarios/${usuario.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senha }) });
      setSenha(''); aoExcluir(d.mensagem);
    } catch (e) { setSenha(''); setErro(e.message); }
    finally { trava.current = false; setOcupado(false); }
  }
  return <dialog ref={dialogo} className="confirmar-exclusao" aria-labelledby="conta-exclusao-titulo" aria-describedby="conta-exclusao-impacto" onCancel={e => { e.preventDefault(); if (!trava.current) aoFechar(); }}>
    <form onSubmit={excluir}>
      <h2 id="conta-exclusao-titulo">Apagar conta permanentemente?</h2>
      <p><strong>{usuario.nome} · {usuario.email}</strong></p>
      <p id="conta-exclusao-impacto">Serão apagados o cadastro, e-mail, senha protegida, CPF/CNPJ, sessões, vínculos de acesso, tokens, convites e e-mails armazenados desta conta. O CPF/CNPJ ficará livre para novo cadastro. Empresas sem outros usuários ativos sairão do seletor. Os dados de empresas, clientes e projetos serão preservados. Esta ação não pode ser desfeita.</p>
      <label>Senha da sua conta administrativa<input type="password" autoComplete="current-password" required maxLength={200} disabled={ocupado} value={senha} onChange={e => setSenha(e.target.value)} /></label>
      {erro && <p role="alert">{erro}</p>}
      <div className="acoes-cliente"><button type="button" disabled={ocupado} onClick={aoFechar}>Cancelar</button><button className="botao-excluir-cliente" disabled={ocupado || !senha}>{ocupado ? 'Apagando…' : 'Apagar conta definitivamente'}</button></div>
    </form>
  </dialog>;
}
