/** Sessão temporária: somente troca da senha ou saída. */
import { useState } from 'react';
import { requisicao } from './api';
export default function TrocarSenha({ aoConcluir, aoSair }) {
  const [atual,setAtual]=useState(''), [nova,setNova]=useState(''), [confirmacao,setConfirmacao]=useState('');
  const [ocupado,setOcupado]=useState(false), [erro,setErro]=useState(''), [concluido,setConcluido]=useState(false);
  async function enviar(event) {
    event.preventDefault(); if(ocupado)return;
    if(nova!==confirmacao){setErro('As novas senhas não coincidem.');return;}
    setOcupado(true);setErro('');
    try {await requisicao('/auth/trocar-senha',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({senha_atual:atual,nova_senha:nova})});setAtual('');setNova('');setConfirmacao('');setConcluido(true);}
    catch(e){setErro(e.message);}finally{setOcupado(false);}
  }
  return <main className="login-pagina" style={{display:'grid',gridTemplateColumns:'1fr'}}><section className="login-area">
    {concluido?<div className="login-card"><h2>Senha atualizada</h2><p className="login-ajuda">Entre novamente com sua nova senha.</p><button className="login-botao" onClick={aoConcluir}>Voltar ao login</button></div>:
    <form className="login-card" onSubmit={enviar}><h2>Proteja seu acesso</h2><p className="login-ajuda">Troque a senha temporária antes de acessar as empresas.</p>
      <label>Senha atual<input type="password" autoComplete="current-password" required maxLength={200} value={atual} onChange={e=>setAtual(e.target.value)}/></label>
      <label>Nova senha<input type="password" autoComplete="new-password" required minLength={10} maxLength={200} value={nova} onChange={e=>setNova(e.target.value)}/></label>
      <label>Confirme a nova senha<input type="password" autoComplete="new-password" required minLength={10} maxLength={200} value={confirmacao} onChange={e=>setConfirmacao(e.target.value)}/></label>
      {erro&&<p className="login-erro" role="alert">{erro}</p>}<button className="login-botao" disabled={ocupado}>{ocupado?'Salvando…':'Salvar nova senha'}</button><div className="login-acoes"><button type="button" disabled={ocupado} onClick={aoSair}>Sair</button></div>
    </form>}
  </section></main>;
}
