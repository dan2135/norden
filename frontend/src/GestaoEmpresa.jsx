import { useEffect, useState } from 'react';
import { requisicao } from './api';
import './GestaoEmpresa.css';

export default function GestaoEmpresa({ podeEditar }) {
  const [relatorio,setRelatorio]=useState(null), [equipe,setEquipe]=useState(null), [erro,setErro]=useState('');
  const [form,setForm]=useState({email:'',papel:'atendente'}), [enviando,setEnviando]=useState(false), [sucesso,setSucesso]=useState('');
  const carregar=()=>Promise.all([requisicao('/relatorios/mensal'),requisicao('/equipe')]).then(([r,e])=>{setRelatorio(r);setEquipe(e);}).catch(e=>setErro(e.message));
  useEffect(()=>{carregar();},[]);
  async function convidar(e){e.preventDefault();setEnviando(true);setErro('');setSucesso('');try{const r=await requisicao('/equipe/convites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});setSucesso(r.mensagem);setForm({email:'',papel:'atendente'});carregar();}catch(err){setErro(err.message);}finally{setEnviando(false);}}
  const cards=[['Atendimentos recebidos',relatorio?.atendimentos],['Projetos iniciados',relatorio?.projetos],['Pedidos assumidos pela equipe',relatorio?.humanos],['Clientes lembrados',relatorio?.lembretes]];
  return <section className="gestao-empresa"><header><p>ACOMPANHE E DIVIDA A ROTINA</p><h1>Gestão da empresa</h1><p>Veja o movimento do mês e organize quem pode trabalhar no painel.</p></header>{erro&&<p role="alert">{erro}</p>}
    <section className="relatorio-mensal"><div><h2>Resumo de {relatorio?.periodo || 'este mês'}</h2><p>Os números consideram somente a empresa selecionada.</p></div><div className="relatorio-cards">{cards.map(([titulo,valor])=><article key={titulo}><strong>{valor ?? '—'}</strong><span>{titulo}</span></article>)}</div></section>
    <section className="equipe"><div><h2>Equipe</h2><p>Convide pessoas para a empresa e escolha o nível de acesso.</p></div>{podeEditar&&equipe?.pode_gerir&&<form onSubmit={convidar} className="convite-form"><label>E-mail<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="pessoa@empresa.com"/></label><label>Função<select value={form.papel} onChange={e=>setForm({...form,papel:e.target.value})}><option value="atendente">Atendente</option><option value="administrador">Administrador</option></select></label><button disabled={enviando}>{enviando?'Enviando…':'Enviar convite'}</button></form>}{sucesso&&<p role="status">{sucesso}</p>}
      <div className="lista-equipe"><h3>Pessoas com acesso</h3>{equipe?.membros?.map(m=><article key={m.id}><div><strong>{m.nome}</strong><small>{m.email}</small></div><span>{m.papel}</span></article>)}</div>
      {equipe?.convites?.length>0&&<div className="lista-equipe"><h3>Convites pendentes</h3>{equipe.convites.map(c=><article key={c.id}><div><strong>{c.email}</strong><small>Convite enviado</small></div><span>{c.papel}</span></article>)}</div>}
    </section>
  </section>;
}
