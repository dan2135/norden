import { useEffect, useState } from 'react';
import { requisicao } from './api';
import { campoParaCentavos, campoParaMilesimos, centavosParaCampo, formatarDinheiro, milesimosParaCampo } from './orcamento-utils';

const novoVazio = { tipo: 'chapa', descricao: '', fornecedor: 'Léo Madeiras', unidade_consumo: 'm2', rendimento: '5,087', preco: '' };
const nomes = { chapa: 'Chapa', fita: 'Fita de borda', dobradica: 'Dobradiça', corredica: 'Corrediça', puxador: 'Puxador', outro: 'Outro' };

function paraForm(m) { return { ...m, rendimento: milesimosParaCampo(m.rendimento_milesimos), preco: centavosParaCampo(m.preco_centavos) }; }
function payload(form) {
  return { tipo: form.tipo, descricao: form.descricao, fornecedor: form.fornecedor, unidade_consumo: form.unidade_consumo,
    rendimento_milesimos: campoParaMilesimos(form.rendimento), preco_centavos: campoParaCentavos(form.preco), ativo: form.ativo !== false };
}

export default function CatalogoEstimativa({ projetoId, aoAplicar }) {
  const [aberto, setAberto] = useState(false);
  const [materiais, setMateriais] = useState([]);
  const [novo, setNovo] = useState(novoVazio);
  const [estimativa, setEstimativa] = useState(null);
  const [estado, setEstado] = useState({ ocupada: false, erro: '', sucesso: '' });

  function carregar() { return requisicao('/catalogo').then(r => setMateriais(r.materiais.map(paraForm))); }
  useEffect(() => { if (aberto && !materiais.length) carregar().catch(e => setEstado({ ocupada:false, erro:e.message, sucesso:'' })); }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps
  async function cadastrar() {
    const dados = payload(novo);
    if (dados.preco_centavos === null || dados.rendimento_milesimos === null) return setEstado({ ocupada:false, erro:'Confira preço e rendimento do material.', sucesso:'' });
    setEstado({ ocupada:true, erro:'', sucesso:'' });
    try { await requisicao('/catalogo', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(dados) }); await carregar(); setNovo(novoVazio); setEstado({ ocupada:false, erro:'', sucesso:'Material cadastrado.' }); }
    catch (e2) { setEstado({ ocupada:false, erro:e2.message, sucesso:'' }); }
  }
  async function salvarMaterial(material) {
    const dados = payload(material);
    if (dados.preco_centavos === null || dados.rendimento_milesimos === null) return setEstado({ ocupada:false, erro:'Confira preço e rendimento.', sucesso:'' });
    setEstado({ ocupada:true, erro:'', sucesso:'' });
    try { await requisicao(`/catalogo/${material.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(dados) }); await carregar(); setEstado({ ocupada:false, erro:'', sucesso:'Preço atualizado.' }); }
    catch (e) { setEstado({ ocupada:false, erro:e.message, sucesso:'' }); }
  }
  async function estimar() {
    setEstado({ ocupada:true, erro:'', sucesso:'' });
    try { setEstimativa(await requisicao(`/projetos/${projetoId}/estimativa`, { method:'POST' })); setEstado({ ocupada:false, erro:'', sucesso:'' }); }
    catch (e) { setEstado({ ocupada:false, erro:e.message, sucesso:'' }); }
  }
  function alterar(id, campo, valor) { setMateriais(ms => ms.map(m => m.id === id ? { ...m, [campo]: valor } : m)); }

  return <section className="catalogo-estimativa">
    <button type="button" className="botao-secundario" onClick={() => setAberto(v => !v)}>{aberto ? 'Fechar estimador' : 'Estimar pelos materiais'}</button>
    {aberto && <div className="conteudo-estimador"><div className="titulo-estimador"><div><h4>Catálogo de referência</h4><p>Cadastre os preços atuais do seu fornecedor. Eles não são buscados nem alterados pela IA.</p></div><button type="button" className="botao-principal" disabled={estado.ocupada} onClick={estimar}>Gerar estimativa</button></div>
      <div className="lista-catalogo">{materiais.map(m => <div className="material-catalogo" key={m.id}>
        <div><strong>{m.descricao}</strong><small>{nomes[m.tipo]} · {m.fornecedor} · embalagem rende {m.rendimento} {m.unidade_consumo}</small></div>
        <label>Preço (R$)<input inputMode="decimal" value={m.preco} onChange={e => alterar(m.id,'preco',e.target.value)} /></label>
        <label className="ativo-catalogo"><input type="checkbox" checked={m.ativo} onChange={e => alterar(m.id,'ativo',e.target.checked)} /> Ativo</label>
        <button type="button" className="botao-secundario" disabled={estado.ocupada} onClick={() => salvarMaterial(m)}>Salvar</button>
      </div>)}</div>
      {!materiais.length && <p className="nota">Cadastre ao menos chapa e fita. Ferragens só entram quando correspondem ao móvel.</p>}
      <div className="novo-material"><h4>Novo material</h4>
        <label>Tipo<select value={novo.tipo} onChange={e => setNovo({...novo,tipo:e.target.value,unidade_consumo:e.target.value==='chapa'?'m2':e.target.value==='fita'?'m':'un',rendimento:e.target.value==='chapa'?'5,087':'1'})}>{Object.entries(nomes).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
        <label className="descricao">Descrição<input required maxLength="200" placeholder="Ex.: MDF branco 18 mm — chapa 2,75 × 1,85 m" value={novo.descricao} onChange={e=>setNovo({...novo,descricao:e.target.value})}/></label>
        <label>Fornecedor<input required maxLength="120" value={novo.fornecedor} onChange={e=>setNovo({...novo,fornecedor:e.target.value})}/></label>
        <label>Rendimento por embalagem<input required inputMode="decimal" value={novo.rendimento} onChange={e=>setNovo({...novo,rendimento:e.target.value})}/></label>
        <label>Unidade<select value={novo.unidade_consumo} onChange={e=>setNovo({...novo,unidade_consumo:e.target.value})}><option value="m2">m²</option><option value="m">m</option><option value="un">un</option></select></label>
        <label>Preço da embalagem (R$)<input required inputMode="decimal" value={novo.preco} onChange={e=>setNovo({...novo,preco:e.target.value})}/></label>
        <button type="button" className="botao-secundario" disabled={estado.ocupada || !novo.descricao.trim() || !novo.fornecedor.trim()} onClick={cadastrar}>Cadastrar</button></div>
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}{estado.sucesso && <p className="aviso sucesso" role="status">{estado.sucesso}</p>}
      {estimativa && <div className="resultado-estimativa"><h4>Prévia da estimativa</h4>
        {estimativa.itens.map((i,idx)=><div className="linha-estimativa" key={`${i.catalogo_id}-${idx}`}><span><strong>{i.quantidade_milesimos/1000} × {i.descricao}</strong><small>{i.fornecedor} · preço atualizado em {new Date(i.atualizado_em).toLocaleDateString('pt-BR')}</small></span><b>{formatarDinheiro(i.quantidade_milesimos/1000*i.valor_unitario_centavos)}</b></div>)}
        {!!estimativa.faltantes.length && <p className="aviso">Sem preço no catálogo: {estimativa.faltantes.map(t=>nomes[t]).join(', ')}.</p>}
        <details><summary>Suposições usadas</summary><ul>{estimativa.suposicoes.map(s=><li key={s}>{s}</li>)}</ul></details><p className="nota">{estimativa.aviso}</p>
        {!!estimativa.itens.length && <button type="button" className="botao-principal" onClick={()=>aoAplicar(estimativa.itens)}>Adicionar estes itens ao orçamento</button>}
      </div>}
    </div>}
  </section>;
}
