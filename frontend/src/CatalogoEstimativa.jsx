/**
 * Interface do catálogo de materiais e da estimativa. Permite revisar preços e aplicar os itens estimados ao formulário do orçamento.
 */
import { useEffect, useState } from 'react';
import { requisicao } from './api';
import { campoParaCentavos, campoParaMilesimos, centavosParaCampo, formatarDinheiro, milesimosParaCampo } from './orcamento-utils';

const tiposTecnicos = new Set(['chapa', 'fita', 'dobradica', 'corredica', 'puxador']);
const nomesBase = { chapa: 'Chapa', fita: 'Fita de borda', dobradica: 'Dobradiça', corredica: 'Corrediça', puxador: 'Puxador', outro: 'Outro' };

// Cada perfil muda textos, tipos e exemplos para o usuário não ver termos de marcenaria em outro ramo.
const perfis = {
  marcenaria: {
    chave: 'marcenaria',
    opcoes: [['chapa', 'Chapa'], ['fita', 'Fita de borda'], ['dobradica', 'Dobradiça'], ['corredica', 'Corrediça'], ['puxador', 'Puxador'], ['outro', 'Outro']],
    tipoPadrao: 'outro',
    descricao: 'Ex.: MDF branco 18 mm — chapa 2,75 × 1,85 m',
    especificacoes: 'Ex.: 2,75 × 1,85 m, espessura 18 mm; cor branca',
    nota: 'Rendimento é quanto uma embalagem contém na unidade escolhida. Ex.: chapa de 2,75 × 1,85 m rende 5,0875 m² (informe 5,088); rolo de 50 m rende 50 m. As medidas descritivas não calculam o rendimento automaticamente.',
  },
  serralheria: {
    chave: 'serralheria',
    opcoes: [['outro', 'Peça, metal ou insumo']],
    tipoPadrao: 'outro',
    descricao: 'Ex.: Tubo metalon 30 × 30 mm, barra chata, eletrodo 6013',
    especificacoes: 'Ex.: barra de 6 m, parede 1,20 mm, aço galvanizado',
    nota: 'Rendimento é quanto vem em cada unidade de compra. Ex.: barra de 6 m rende 6 m; caixa com 100 peças rende 100 un. Use a descrição para registrar bitola, espessura, liga, modelo e acabamento.',
  },
  comercio: {
    chave: 'comercio',
    opcoes: [['outro', 'Produto ou mercadoria']],
    tipoPadrao: 'outro',
    descricao: 'Ex.: Kit fechadura inox, peça de reposição, caixa com 12 unidades',
    especificacoes: 'Ex.: modelo, marca, tamanho, cor, embalagem ou variação',
    nota: 'Rendimento é quanto vem em cada embalagem ou unidade de compra. Ex.: caixa com 12 unidades rende 12 un; rolo de 20 m rende 20 m. Use as especificações para modelo, marca e variações.',
  },
  servicos: {
    chave: 'servicos',
    opcoes: [['outro', 'Material ou insumo']],
    tipoPadrao: 'outro',
    descricao: 'Ex.: Cabo PP 2,5 mm, massa corrida, kit de instalação',
    especificacoes: 'Ex.: metro linear, embalagem, voltagem, tamanho, modelo ou aplicação',
    nota: 'Rendimento é quanto vem em cada embalagem ou unidade de compra. Ex.: rolo de 50 m rende 50 m; pacote com 25 peças rende 25 un. Use os campos para registrar o que sua equipe realmente usa.',
  },
  outros: {
    chave: 'outros',
    opcoes: [['outro', 'Material, peça ou insumo']],
    tipoPadrao: 'outro',
    descricao: 'Ex.: Peça, insumo, kit, produto ou material usado na sua rotina',
    especificacoes: 'Ex.: medidas, modelo, embalagem, unidade, acabamento ou aplicação',
    nota: 'Rendimento é quanto vem em cada embalagem ou unidade de compra. Ex.: pacote com 100 peças rende 100 un; barra de 6 m rende 6 m. Use descrição e especificações do jeito que fizer sentido para seu ramo.',
  },
};

function normalizar(texto = '') { return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function perfilCatalogo(segmento = 'outros', atividade = '') {
  // Além do segmento salvo, tenta reconhecer atividade digitada manualmente como serralheria/solda/metal.
  const texto = normalizar(atividade);
  if (segmento === 'serralheria' || /(serralh|sold|metal|aco|ferro|aluminio|caldeiraria)/.test(texto)) return perfis.serralheria;
  return perfis[segmento] || perfis.outros;
}
function novoVazio(perfil) { return { tipo: perfil.tipoPadrao, descricao: '', especificacoes: '', fornecedor: '', unidade_consumo: perfil.chave === 'marcenaria' ? 'un' : 'un', rendimento: '1', preco: '' }; }
function unidadePadrao(tipo, perfil) { return tipo === 'chapa' ? 'm2' : tipo === 'fita' ? 'm' : perfil.chave === 'serralheria' ? 'm' : 'un'; }
function nomeTipo(tipo, perfil) { return perfil.opcoes.find(([valor]) => valor === tipo)?.[1] || nomesBase[tipo] || perfil.opcoes[0]?.[1] || 'Material'; }

// Converte valores vindos do banco para strings editáveis nos inputs.
function paraForm(m) { return { ...m, rendimento: milesimosParaCampo(m.rendimento_milesimos), preco: centavosParaCampo(m.preco_centavos) }; }

// Converte o formulário de volta para o formato seguro usado pelo backend.
function payload(form) {
  return { tipo: form.tipo, descricao: form.descricao, fornecedor: form.fornecedor, unidade_consumo: form.unidade_consumo,
    rendimento_milesimos: campoParaMilesimos(form.rendimento), preco_centavos: campoParaCentavos(form.preco), ativo: form.ativo !== false, especificacoes: form.especificacoes || '' };
}

export default function CatalogoEstimativa({ projetoId, aoAplicar, somenteCatalogo = false, somenteLeitura = false, segmento = 'outros', atividade = '' }) {
  // O mesmo componente serve para cadastro de materiais e para gerar estimativa dentro do orçamento.
  const perfil = perfilCatalogo(segmento, atividade);
  const [aberto, setAberto] = useState(somenteCatalogo);
  const [materiais, setMateriais] = useState([]);
  const [novo, setNovo] = useState(() => novoVazio(perfil));
  const [estimativa, setEstimativa] = useState(null);
  const [estado, setEstado] = useState({ ocupada: false, erro: '', sucesso: '' });
  const materiaisVisiveis = perfil.chave === 'marcenaria' ? materiais : materiais.filter(m => !tiposTecnicos.has(m.tipo));

  // Busca o catálogo da empresa ativa; a seleção da empresa já foi enviada no cabeçalho pela camada de API.
  function carregar() { return requisicao('/catalogo').then(r => setMateriais(r.materiais.map(paraForm))); }
  useEffect(() => { if (aberto && !materiais.length) carregar().catch(e => setEstado({ ocupada:false, erro:e.message, sucesso:'' })); }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps
  // Ao trocar de ramo, limpa o formulário de novo material para usar exemplos/unidades corretas.
  useEffect(() => { setNovo(novoVazio(perfil)); }, [perfil.chave]);
  async function cadastrar() {
    // Valida preço e rendimento no frontend para dar retorno rápido antes de enviar ao servidor.
    const dados = payload(novo);
    if (dados.preco_centavos === null || dados.rendimento_milesimos === null) return setEstado({ ocupada:false, erro:'Confira preço e rendimento do material.', sucesso:'' });
    setEstado({ ocupada:true, erro:'', sucesso:'' });
    try { await requisicao('/catalogo', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(dados) }); await carregar(); setNovo(novoVazio(perfil)); setEstado({ ocupada:false, erro:'', sucesso:'Material cadastrado.' }); }
    catch (e2) { setEstado({ ocupada:false, erro:e2.message, sucesso:'' }); }
  }
  async function salvarMaterial(material) {
    // Atualiza preço, descrição, fornecedor e status ativo de um material já cadastrado.
    const dados = payload(material);
    if (dados.preco_centavos === null || dados.rendimento_milesimos === null) return setEstado({ ocupada:false, erro:'Confira preço e rendimento.', sucesso:'' });
    setEstado({ ocupada:true, erro:'', sucesso:'' });
    try { await requisicao(`/catalogo/${material.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(dados) }); await carregar(); setEstado({ ocupada:false, erro:'', sucesso:'Preço atualizado.' }); }
    catch (e) { setEstado({ ocupada:false, erro:e.message, sucesso:'' }); }
  }
  async function estimar() {
    // Pede ao backend para cruzar medidas do projeto com o catálogo e sugerir itens de orçamento.
    setEstado({ ocupada:true, erro:'', sucesso:'' });
    try { setEstimativa(await requisicao(`/projetos/${projetoId}/estimativa`, { method:'POST' })); setEstado({ ocupada:false, erro:'', sucesso:'' }); }
    catch (e) { setEstado({ ocupada:false, erro:e.message, sucesso:'' }); }
  }
  function alterar(id, campo, valor) { setMateriais(ms => ms.map(m => m.id === id ? { ...m, [campo]: valor } : m)); }

  return <section className="catalogo-estimativa">
    {!somenteCatalogo && <button type="button" className="botao-secundario" onClick={() => setAberto(v => !v)}>{aberto ? 'Fechar estimador' : 'Estimar pelos materiais'}</button>}
    {aberto && <div className="conteudo-estimador"><div className="titulo-estimador"><div><h4>Materiais da empresa</h4><p>Prepare um catálogo com os itens do seu ramo. Eles ficam salvos para os próximos projetos desta empresa.</p></div>{!somenteCatalogo && <button type="button" className="botao-principal" disabled={estado.ocupada} onClick={estimar}>Gerar estimativa</button>}</div>
      {/* Lista de materiais existentes: em outros ramos oculta tipos técnicos exclusivos de marcenaria. */}
      <div className="lista-catalogo">{materiaisVisiveis.map(m => <div className="material-catalogo" key={m.id}>
        <div><strong>{m.descricao}</strong><small>{nomeTipo(m.tipo, perfil)} · {m.fornecedor} · embalagem rende {m.rendimento} {m.unidade_consumo}</small></div>
        <label>Descrição<input disabled={somenteLeitura} maxLength={200} value={m.descricao} onChange={e => alterar(m.id,'descricao',e.target.value)} /></label>
        <label>Medidas e especificações<input disabled={somenteLeitura} maxLength={500} value={m.especificacoes || ''} onChange={e => alterar(m.id,'especificacoes',e.target.value)} /></label>
        <label>Fornecedor<input disabled={somenteLeitura} maxLength={120} value={m.fornecedor} onChange={e => alterar(m.id,'fornecedor',e.target.value)} /></label>
        <label>Rendimento por embalagem<input disabled={somenteLeitura} inputMode="decimal" value={m.rendimento} onChange={e => alterar(m.id,'rendimento',e.target.value)} /></label>
        <label>Preço (R$)<input disabled={somenteLeitura} inputMode="decimal" value={m.preco} onChange={e => alterar(m.id,'preco',e.target.value)} /></label>
        <label className="ativo-catalogo"><input disabled={somenteLeitura} type="checkbox" checked={m.ativo} onChange={e => alterar(m.id,'ativo',e.target.checked)} /> Ativo</label>
        <button type="button" className="botao-secundario" disabled={estado.ocupada || somenteLeitura} onClick={() => salvarMaterial(m)}>Salvar</button>
      </div>)}</div>
      {!materiaisVisiveis.length && <p className="nota">Nenhum material cadastrado para este ramo. Adicione os itens que sua empresa costuma usar.</p>}
      {/* Cadastro de um novo item usado pela empresa; os exemplos mudam conforme o ramo. */}
      {!somenteLeitura && <div className="novo-material"><h4>Novo material</h4>
        <label>Tipo<select value={novo.tipo} onChange={e => setNovo({...novo,tipo:e.target.value,unidade_consumo:unidadePadrao(e.target.value, perfil),rendimento:'1'})}>{perfil.opcoes.map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
        <label className="descricao">Descrição<input required maxLength="200" placeholder={perfil.descricao} value={novo.descricao} onChange={e=>setNovo({...novo,descricao:e.target.value})}/></label>
        <label>Fornecedor<input required maxLength="120" value={novo.fornecedor} onChange={e=>setNovo({...novo,fornecedor:e.target.value})}/></label>
        <label className="descricao">Medidas e especificações<input maxLength={500} placeholder={perfil.especificacoes} value={novo.especificacoes} onChange={e=>setNovo({...novo,especificacoes:e.target.value})}/></label>
        <label>Rendimento por embalagem<input required inputMode="decimal" value={novo.rendimento} onChange={e=>setNovo({...novo,rendimento:e.target.value})}/></label>
        <label>Unidade<select value={novo.unidade_consumo} onChange={e=>setNovo({...novo,unidade_consumo:e.target.value})}><option value="m2">m²</option><option value="m">m</option><option value="un">un</option></select></label>
        <label>Preço da embalagem (R$)<input required inputMode="decimal" value={novo.preco} onChange={e=>setNovo({...novo,preco:e.target.value})}/></label>
        <button type="button" className="botao-secundario" disabled={estado.ocupada || !novo.descricao.trim() || !novo.fornecedor.trim()} onClick={cadastrar}>Cadastrar material</button></div>}
      <p className="nota">{perfil.nota}</p>
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}{estado.sucesso && <p className="aviso sucesso" role="status">{estado.sucesso}</p>}
      {/* Resultado da estimativa: prévia revisável antes de inserir itens no orçamento. */}
      {estimativa && <div className="resultado-estimativa"><h4>Prévia da estimativa</h4>
        {estimativa.itens.map((i,idx)=><div className="linha-estimativa" key={`${i.catalogo_id}-${idx}`}><span><strong>{i.quantidade_milesimos/1000} × {i.descricao}</strong><small>{i.fornecedor} · preço atualizado em {new Date(i.atualizado_em).toLocaleDateString('pt-BR')}</small></span><b>{formatarDinheiro(i.quantidade_milesimos/1000*i.valor_unitario_centavos)}</b></div>)}
        {!!estimativa.faltantes.length && <p className="aviso">Sem preço no catálogo: {estimativa.faltantes.map(t=>nomeTipo(t, perfil)).join(', ')}.</p>}
        <details><summary>Suposições usadas</summary><ul>{estimativa.suposicoes.map(s=><li key={s}>{s}</li>)}</ul></details><p className="nota">{estimativa.aviso}</p>
        {!!estimativa.itens.length && <button type="button" className="botao-principal" onClick={()=>aoAplicar(estimativa.itens)}>Adicionar estes itens ao orçamento</button>}
      </div>}
    </div>}
  </section>;
}
