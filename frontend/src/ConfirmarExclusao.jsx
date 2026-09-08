import { useEffect, useRef, useState } from 'react';
import { requisicao } from './api';

export default function ConfirmarExclusao({ alvo, aoFechar, aoExcluir }) {
  const dialogo=useRef(null);
  const trava=useRef(false);
  const [senha,setSenha]=useState('');
  const [erro,setErro]=useState('');
  const [ocupado,setOcupado]=useState(false);
  useEffect(()=>{
    const elemento=dialogo.current;
    elemento.showModal();
    return ()=>elemento.close();
  },[]);
  async function confirmar(evento) {
    evento.preventDefault();
    if(trava.current)return;
    trava.current=true;setOcupado(true);setErro('');
    try {
      const resultado=await requisicao(`/${alvo.tipo==='cliente'?'clientes':'projetos'}/${alvo.item.id}/permanente`,{
        method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({senha}),
      });
      setSenha('');aoExcluir(resultado.mensagem);
    } catch(e){setSenha('');setErro(e.message);}
    finally{trava.current=false;setOcupado(false);}
  }
  return <dialog ref={dialogo} className="confirmar-exclusao" aria-labelledby="exclusao-titulo" aria-describedby="exclusao-impacto" onCancel={e=>{e.preventDefault();if(!trava.current)aoFechar();}}>
    <form onSubmit={confirmar}>
      <h2 id="exclusao-titulo">Excluir {alvo.tipo} permanentemente?</h2>
      <p><strong>#{alvo.item.id} · {alvo.item.nome||alvo.item.movel||alvo.item.telefone||'Sem nome'}</strong></p>
      <p id="exclusao-impacto">{alvo.tipo==='cliente'?'Todos os projetos, mensagens e orçamentos deste cliente serão apagados, inclusive os que estão na lixeira.':'Este projeto, suas mensagens e seu orçamento serão apagados. O cliente e os outros projetos serão mantidos.'} Não será possível restaurar pela lixeira.</p>
      <label htmlFor="senha-exclusao">Senha da sua conta</label>
      <input id="senha-exclusao" type="password" autoComplete="current-password" required maxLength={200} value={senha} disabled={ocupado} onChange={e=>setSenha(e.target.value)} aria-describedby={erro?'exclusao-erro':undefined}/>
      {erro&&<p id="exclusao-erro" role="alert" className="aviso erro">{erro}</p>}
      <div className="acoes-cliente"><button type="button" className="botao-secundario" disabled={ocupado} onClick={aoFechar}>Cancelar</button><button type="submit" className="botao-excluir-cliente" disabled={ocupado||!senha}>{ocupado?'Excluindo…':'Excluir permanentemente'}</button></div>
    </form>
  </dialog>;
}
