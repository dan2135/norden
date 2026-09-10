/**
 * Funções de apresentação e filtros do painel. Não consultam o banco nem alteram os registros.
 */
export const categorias = { em_coleta: 'Em coleta', pendente: 'Confirmar dados', completo: 'Dados completos' };

export function normalizarBusca(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function filtrarProjetos(projetos, { busca = '', cliente = '', categoria = '' } = {}) {
  const termo = normalizarBusca(busca.trim());
  return projetos.filter(p => (!cliente || String(p.cliente_id) === cliente)
    && (!categoria || p.situacao.categoria === categoria)
    && normalizarBusca([p.id, p.coleta?.geral?.solicitacao, p.coleta?.geral?.detalhes, p.movel, p.uso, p.cliente_nome, p.telefone].join(' ')).includes(termo));
}

export function filtrarClientes(clientes, busca = '') {
  const termo = normalizarBusca(busca.trim());
  return clientes.filter(c => normalizarBusca([c.id, c.nome, c.telefone].join(' ')).includes(termo));
}

export function formatarData(valor) {
  if (!valor || Number.isNaN(new Date(valor).getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor));
}

export function formatarMedida(valor) {
  return valor === null || valor === undefined || valor === '' || !Number.isFinite(Number(valor))
    ? 'Não informada' : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(valor))} cm`;
}
