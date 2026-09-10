/**
 * Valida o telefone, monta o texto com os valores salvos e codifica o link de compartilhamento manual.
 */
import { formatarDinheiro } from './orcamento-utils.js';

export function telefoneWhatsApp(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '');
  if (/^55\d{10,11}$/.test(digitos)) return digitos;
  if (/^\d{10,11}$/.test(digitos)) return `55${digitos}`;
  return null;
}

function quantidade(item) {
  return String(Number(item.quantidade_milesimos) / 1000).replace('.', ',');
}

export function mensagemOrcamento(orcamento, projeto) {
  const numero = `ORC-${String(orcamento.id).padStart(6, '0')}`;
  const linhas = [
    `Olá${projeto.cliente_nome ? `, ${projeto.cliente_nome}` : ''}!`, '',
    `Segue o orçamento ${numero} para ${projeto.coleta?.geral?.solicitacao || projeto.movel || 'o pedido solicitado'}${projeto.uso ? ` — ${projeto.uso}` : ''}:`, '',
  ];
  for (const item of orcamento.itens) {
    const total = Math.round(Number(item.quantidade_milesimos) * Number(item.valor_unitario_centavos) / 1000);
    linhas.push(`• ${quantidade(item)} × ${item.descricao}: ${formatarDinheiro(total)}`);
  }
  linhas.push('', `Subtotal: ${formatarDinheiro(orcamento.subtotal_centavos)}`);
  if (Number(orcamento.desconto_centavos) > 0) linhas.push(`Desconto: − ${formatarDinheiro(orcamento.desconto_centavos)}`);
  linhas.push(`*Total: ${formatarDinheiro(orcamento.total_centavos)}*`);
  if (orcamento.validade) linhas.push(`Validade: ${new Date(`${orcamento.validade.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')}`);
  if (orcamento.observacoes) linhas.push('', orcamento.observacoes);
  linhas.push('', 'Fico à disposição para tirar dúvidas.');
  return linhas.join('\n');
}

export function linkWhatsApp(telefone, mensagem) {
  const numero = telefoneWhatsApp(telefone);
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}` : null;
}
