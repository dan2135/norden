/** Área independente de clientes/projetos: perfil do negócio e catálogo compartilhado. */
import { useEffect, useState } from 'react';
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

export default function ConfiguracaoEmpresa({ aoSalvar, podeEditar }) {
  const [empresa, setEmpresa] = useState(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let cancelado = false;
    requisicao('/empresa-configuracao').then(({empresa}) => { if (!cancelado) setEmpresa(empresa); }).catch(e => { if (!cancelado) setErro(e.message); });
    return () => { cancelado = true; };
  }, [tentativa]);
  async function salvar(e) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true); setErro(''); setSucesso('');
    try {
      const resultado = await requisicao('/empresa-configuracao', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(empresa) });
      setEmpresa(resultado.empresa); aoSalvar(resultado.empresa); setSucesso('Empresa configurada. Você já pode preparar os materiais abaixo e iniciar suas conversas.');
    } catch (erro) { setErro(erro.message); } finally { setOcupado(false); }
  }
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
          <label>{empresa.segmento === 'outros' ? 'Qual é o ramo da sua empresa?' : 'Com o que você trabalha?'}<input required maxLength={200} placeholder={exemplosAtividade[empresa.segmento] || exemplosAtividade.outros} value={empresa.atividade} onChange={e=>setEmpresa({...empresa,atividade:e.target.value})}/></label>
          <button type="submit">{ocupado ? 'Salvando…' : 'Salvar perfil da empresa'}</button>
        </fieldset>
        {!podeEditar && <p>Peça ao administrador da empresa para alterar o perfil.</p>}
      </form>
      {sucesso && <p role="status">{sucesso}</p>}
      <CatalogoEstimativa somenteCatalogo somenteLeitura={!podeEditar} segmento={empresa.segmento} atividade={empresa.atividade} />
    </>}
  </section>;
}
