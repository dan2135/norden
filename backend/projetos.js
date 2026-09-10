/**
 * Reúne validações e consultas do atendimento. Cliente, projeto e histórico são selecionados com o identificador da empresa para evitar mistura de dados.
 */
// Cria um erro com status HTTP para que a rota devolva uma mensagem de validação ao cliente.
function erroHttp(status, mensagem) {
  return Object.assign(new Error(mensagem), { status });
}

// Normaliza o telefone e rejeita formatos que não identificam um cliente válido.
function validarTelefone(telefone) {
  if (typeof telefone !== 'string' || !/^\d{10,15}$/.test(telefone)) {
    throw erroHttp(400, 'Informe um telefone com 10 a 15 dígitos.');
  }
  return telefone;
}

// Aceita somente identificadores inteiros positivos antes de consultar o banco.
function validarId(id) {
  if (!/^[1-9]\d*$/.test(String(id)) || !Number.isSafeInteger(Number(id))) {
    throw erroHttp(400, 'Projeto inválido.');
  }
  return Number(id);
}

// Valida o projeto solicitado e evita escolher silenciosamente entre vários projetos do cliente.
async function selecionarProjeto(db, clienteId, projetoId, marcenariaId) {
  if (projetoId !== undefined && projetoId !== null) {
    const resultado = await db.query(
      'SELECT * FROM projetos WHERE id = $1 AND cliente_id = $2 AND marcenaria_id = $3 AND excluido_em IS NULL',
      [validarId(projetoId), clienteId, marcenariaId],
    );
    if (!resultado.rows[0]) throw erroHttp(404, 'Projeto não encontrado para este cliente.');
    return resultado.rows[0];
  }
  const resultado = await db.query('SELECT * FROM projetos WHERE cliente_id = $1 AND marcenaria_id = $2 AND excluido_em IS NULL ORDER BY id', [clienteId, marcenariaId]);
  if (resultado.rows.length > 1) throw erroHttp(409, 'Selecione o projeto antes de enviar a mensagem.');
  if (resultado.rows.length === 1) return resultado.rows[0];
  return (await db.query('INSERT INTO projetos (cliente_id,marcenaria_id) VALUES ($1,$2) RETURNING *', [clienteId,marcenariaId])).rows[0];
}

// Localiza ou cria o cliente pelo telefone dentro da empresa selecionada.
async function obterCliente(db, telefone, marcenariaId) {
  // Serializa operações do mesmo cliente, inclusive quando ainda não existe.
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2::text))", [telefone,marcenariaId]);
  const existente = await db.query('SELECT * FROM clientes WHERE telefone = $1 AND marcenaria_id=$2', [telefone,marcenariaId]);
  if (existente.rows[0]?.excluido_em) throw erroHttp(409, 'Cliente na lixeira. Restaure-o no painel para continuar.');
  return existente.rows[0] ?? (await db.query(
    'INSERT INTO clientes (telefone,marcenaria_id) VALUES ($1,$2) RETURNING *', [telefone,marcenariaId],
  )).rows[0];
}

// Busca mensagens somente do cliente, projeto e empresa indicados, em ordem estável.
async function historicoProjeto(db, clienteId, projetoId, marcenariaId) {
  return (await db.query(
    'SELECT id, remetente, texto, criado_em FROM mensagens WHERE cliente_id = $1 AND projeto_id = $2 AND marcenaria_id=$3 ORDER BY criado_em ASC, id ASC',
    [clienteId, projetoId, marcenariaId],
  )).rows;
}

module.exports = { erroHttp, validarTelefone, validarId, selecionarProjeto, obterCliente, historicoProjeto };
