/** Painel privado para a Norden entender por que empresas desligam a Suzy. */
import { useEffect, useState } from 'react';
import { requisicao } from './api';
import { formatarData } from './painel-utils';
import './FeedbackDesconexao.css';

export default function FeedbackDesconexao() {
  const [estado, setEstado] = useState({ carregando:true, erro:'', feedbacks:[] });
  function carregar() {
    setEstado(atual => ({ ...atual, carregando:true, erro:'' }));
    requisicao('/admin/feedback-desconexao').then(({feedbacks}) => setEstado({ carregando:false, erro:'', feedbacks:feedbacks || [] }))
      .catch(erro => setEstado({ carregando:false, erro:erro.message, feedbacks:[] }));
  }
  useEffect(carregar, []);
  return <main className="feedback-desconexao"><header><p>ADMINISTRAÇÃO NORDEN</p><h1>Feedbacks sobre a Suzy</h1><span>{estado.feedbacks.length} recebidos</span><button className="botao-secundario" onClick={carregar} disabled={estado.carregando}>{estado.carregando ? 'Atualizando…' : 'Atualizar'}</button></header>
    {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
    {!estado.carregando && !estado.feedbacks.length && <div className="estado-vazio"><h2>Nenhum feedback ainda</h2><p>Quando uma empresa desconectar a Suzy e explicar o motivo, ele aparecerá aqui.</p></div>}
    <section>{estado.feedbacks.map(item => <article key={item.id}><div><strong>{item.empresa}</strong><time>{formatarData(item.criado_em)}</time></div><p>{item.motivo}</p></article>)}</section>
  </main>;
}
