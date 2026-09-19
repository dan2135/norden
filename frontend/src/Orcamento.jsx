/**
 * Editor da proposta: converte dados salvos em campos editáveis, calcula a prévia e envia a versão ao backend para persistência.
 */
import { useEffect, useState } from 'react';
import { requisicao } from './api';
import { campoParaCentavos, campoParaMilesimos, centavosParaCampo, formatarDinheiro, milesimosParaCampo, totalItem } from './orcamento-utils';
import './Orcamento.css';
import CatalogoEstimativa from './CatalogoEstimativa';
import WhatsAppOrcamento from './WhatsAppOrcamento';

const itemVazio = () => ({ descricao: '', categoria: 'material', quantidade: '1', unidade: 'un', valor: '0,00' });

function paraFormulario(o) {
  // O backend trabalha em centavos/milésimos; o formulário exibe valores amigáveis em pt-BR.
  return { status: o.status, validade: o.validade?.slice(0, 10) || '', observacoes: o.observacoes || '', desconto: centavosParaCampo(o.desconto_centavos),
    itens: o.itens.map(i => ({ descricao: i.descricao, categoria: i.categoria, quantidade: milesimosParaCampo(i.quantidade_milesimos), unidade: i.unidade, valor: centavosParaCampo(i.valor_unitario_centavos) })) };
}

export default function Orcamento({ projeto, aoSalvar }) {
  // Mantém separada a cópia salva no banco e a cópia editável do formulário.
  const [carregando, setCarregando] = useState(true);
  const [orcamento, setOrcamento] = useState(null);
  const [form, setForm] = useState(null);
  const [mensagem, setMensagem] = useState({ erro: '', sucesso: '' });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    // Sempre que troca o projeto, busca o orçamento correspondente e prepara os campos editáveis.
    let cancelado = false;
    requisicao(`/projetos/${projeto.id}/orcamento`).then(r => { if (!cancelado) { setOrcamento(r.orcamento); setForm(r.orcamento ? paraFormulario(r.orcamento) : null); setCarregando(false); } })
      .catch(e => { if (!cancelado) { setMensagem({ erro: e.message, sucesso: '' }); setCarregando(false); } });
    return () => { cancelado = true; };
  }, [projeto.id]);

  async function criar() {
    // Cria o rascunho inicial no servidor para garantir ID, versão e itens padrão.
    setSalvando(true); setMensagem({ erro: '', sucesso: '' });
    try { const r = await requisicao(`/projetos/${projeto.id}/orcamento`, { method: 'POST' }); setOrcamento(r.orcamento); setForm(paraFormulario(r.orcamento)); }
    catch (e) { setMensagem({ erro: e.message, sucesso: '' }); } finally { setSalvando(false); }
  }
  // Atualizações de item são locais até o usuário salvar; isso evita gravar cada tecla no banco.
  function alterarItem(indice, campo, valor) { setForm(f => ({ ...f, itens: f.itens.map((item, i) => i === indice ? { ...item, [campo]: valor } : item) })); }
  function remover(indice) { setForm(f => ({ ...f, itens: f.itens.filter((_, i) => i !== indice) })); }
  function aplicarEstimativa(itens) {
    // A estimativa entra como sugestão; o usuário revisa descrição, quantidade e valor antes de persistir.
    const sugeridos = itens.map(i => ({ descricao: `${i.descricao} (estimado)`, categoria: i.categoria, quantidade: milesimosParaCampo(i.quantidade_milesimos), unidade: i.unidade, valor: centavosParaCampo(i.valor_unitario_centavos) }));
    setForm(f => ({ ...f, itens: [...f.itens, ...sugeridos] }));
    setMensagem({ erro: '', sucesso: 'Itens estimados adicionados. Revise antes de salvar.' });
  }
  async function salvar(e) {
    // Antes de enviar, converte campos digitados para unidades seguras e rejeita valores inválidos.
    e.preventDefault(); setMensagem({ erro: '', sucesso: '' });
    const desconto = campoParaCentavos(form.desconto);
    const itens = form.itens.map(i => ({ descricao: i.descricao, categoria: i.categoria, unidade: i.unidade,
      quantidade_milesimos: campoParaMilesimos(i.quantidade), valor_unitario_centavos: campoParaCentavos(i.valor) }));
    if (desconto === null || itens.some(i => i.quantidade_milesimos === null || i.valor_unitario_centavos === null)) {
      setMensagem({ erro: 'Confira quantidades e valores. Use até três casas na quantidade e duas nos valores.', sucesso: '' }); return;
    }
    setSalvando(true);
    try {
      const r = await requisicao(`/orcamentos/${orcamento.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, desconto_centavos: desconto, versao: orcamento.versao, itens }) });
      setOrcamento(r.orcamento); setForm(paraFormulario(r.orcamento)); setMensagem({ erro: '', sucesso: 'Orçamento salvo com segurança.' }); aoSalvar?.();
    } catch (erro) { setMensagem({ erro: erro.message, sucesso: '' }); } finally { setSalvando(false); }
  }

  if (carregando) return <section className="orcamento"><p role="status">Carregando orçamento…</p></section>;
  if (!orcamento) return <section className="orcamento"><div className="titulo-orcamento"><div><h3>Orçamento</h3><p>Crie um rascunho sem preços automáticos.</p></div>
    <button className="botao-principal" disabled={salvando} onClick={criar}>{salvando ? 'Criando…' : 'Criar orçamento'}</button></div>
    {mensagem.erro && <p className="aviso erro" role="alert">{mensagem.erro}</p>}</section>;

  const subtotal = form.itens.reduce((s, i) => s + totalItem(i), 0);
  const desconto = campoParaCentavos(form.desconto) || 0;
  // Se houver alteração local, bloqueia o compartilhamento pelo WhatsApp até salvar a versão final.
  const alterado = JSON.stringify(form) !== JSON.stringify(paraFormulario(orcamento));
  return <section className="orcamento">
    <div className="titulo-orcamento"><div><p className="sobretitulo">ORC-{String(orcamento.id).padStart(6, '0')}</p><h3>Orçamento de {projeto.coleta?.geral?.solicitacao || projeto.movel || 'projeto'}</h3></div>
      <button type="button" className="botao-secundario" onClick={() => window.print()}>Imprimir / salvar PDF</button></div>
    <p className="nota">Valores são preenchidos manualmente. O total é recalculado e validado pelo servidor.</p>
    <form onSubmit={salvar}>
      {/* Dados gerais da proposta: situação comercial e validade que aparecerão no orçamento salvo. */}
      <div className="campos-orcamento"><label>Situação<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
        <option value="rascunho">Rascunho</option><option value="pronto">Pronto para enviar</option><option value="aprovado">Aprovado pelo cliente</option><option value="recusado">Recusado</option>
      </select></label><label>Validade<input type="date" value={form.validade} onChange={e => setForm({ ...form, validade: e.target.value })} /></label></div>
      {/* Estimador aparece apenas quando o projeto usa o catálogo técnico de marcenaria. */}
      {(!projeto.segmento || projeto.segmento === 'marcenaria') && <CatalogoEstimativa projetoId={projeto.id} aoAplicar={aplicarEstimativa} segmento={projeto.segmento || 'marcenaria'} />}
      {/* Itens editáveis do orçamento: materiais, serviços, transporte e qualquer cobrança extra. */}
      <div className="itens-orcamento">
        {form.itens.map((item, i) => <fieldset key={i}><legend>Item {i + 1}</legend>
          <label className="descricao">Descrição<input required maxLength="200" value={item.descricao} onChange={e => alterarItem(i, 'descricao', e.target.value)} /></label>
          <label>Categoria<select value={item.categoria} onChange={e => alterarItem(i, 'categoria', e.target.value)}><option value="material">Material</option><option value="ferragem">Ferragem</option><option value="mao_de_obra">Mão de obra</option><option value="transporte">Transporte</option><option value="outro">Outro</option></select></label>
          <label>Quantidade<input inputMode="decimal" required value={item.quantidade} onChange={e => alterarItem(i, 'quantidade', e.target.value)} /></label>
          <label>Unidade<select value={item.unidade} onChange={e => alterarItem(i, 'unidade', e.target.value)}><option value="un">un</option><option value="m">m</option><option value="m2">m²</option><option value="m3">m³</option><option value="h">hora</option><option value="servico">serviço</option></select></label>
          <label>Valor unitário<input inputMode="decimal" required value={item.valor} onChange={e => alterarItem(i, 'valor', e.target.value)} /></label>
          <strong className="total-item">{formatarDinheiro(totalItem(item))}</strong><button type="button" className="remover-item" onClick={() => remover(i)}>Remover</button>
        </fieldset>)}
      </div>
      <button type="button" className="botao-secundario adicionar-item" onClick={() => setForm({ ...form, itens: [...form.itens, itemVazio()] })}>+ Adicionar item</button>
      {/* Fechamento recalcula subtotal, desconto e total em tempo real para evitar surpresa ao salvar. */}
      <div className="fechamento-orcamento"><label>Desconto (R$)<input inputMode="decimal" value={form.desconto} onChange={e => setForm({ ...form, desconto: e.target.value })} /></label>
        <dl><div><dt>Subtotal</dt><dd>{formatarDinheiro(subtotal)}</dd></div><div><dt>Desconto</dt><dd>− {formatarDinheiro(desconto)}</dd></div><div className="total"><dt>Total</dt><dd>{formatarDinheiro(Math.max(0, subtotal - desconto))}</dd></div></dl></div>
      <label className="observacoes">Observações<textarea maxLength="4000" rows="4" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} placeholder="Prazo, condições de pagamento ou informações importantes" /></label>
      {mensagem.erro && <p className="aviso erro" role="alert">{mensagem.erro}</p>}{mensagem.sucesso && <p className="aviso sucesso" role="status">{mensagem.sucesso}</p>}
      <button className="botao-principal" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar orçamento'}</button>
    </form>
    <WhatsAppOrcamento orcamento={orcamento} projeto={projeto} alterado={alterado} />
  </section>;
}
