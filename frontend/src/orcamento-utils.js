export const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarDinheiro(centavos) { return moeda.format((Number(centavos) || 0) / 100); }
export function centavosParaCampo(centavos) { return ((Number(centavos) || 0) / 100).toFixed(2).replace('.', ','); }
export function campoParaCentavos(valor) {
  const limpo = String(valor ?? '').trim().replace(/\s|R\$/gi, '');
  if (!/^\d{1,10}([.,]\d{0,2})?$/.test(limpo)) return null;
  return Math.round(Number(limpo.replace(',', '.')) * 100);
}
export function milesimosParaCampo(valor) { return String(Number(valor) / 1000).replace('.', ','); }
export function campoParaMilesimos(valor) {
  const limpo = String(valor ?? '').trim();
  if (!/^\d{1,6}([.,]\d{0,3})?$/.test(limpo)) return null;
  const numero = Number(limpo.replace(',', '.'));
  return numero > 0 ? Math.round(numero * 1000) : null;
}
export function totalItem(item) {
  const quantidade = campoParaMilesimos(item.quantidade);
  const valor = campoParaCentavos(item.valor);
  return quantidade === null || valor === null ? 0 : Math.round(quantidade * valor / 1000);
}
