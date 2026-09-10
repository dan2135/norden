/**
 * Valida e persiste propostas e seus itens. Valores são representados em centavos e quantidades em milésimos; o orçamento salvo não depende de preços futuros do catálogo.
 */
const { validarId, erroHttp } = require('./projetos');

const categorias = new Set(['material', 'ferragem', 'mao_de_obra', 'transporte', 'outro']);
const unidades = new Set(['un', 'm', 'm2', 'm3', 'h', 'servico']);
const statusPermitidos = new Set(['rascunho', 'pronto', 'aprovado', 'recusado']);

// Rejeita valores negativos, fracionários ou grandes demais para a operação monetária.
function validarInteiro(valor, nome, maximo = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(valor) || valor < 0 || valor > maximo) throw erroHttp(400, `${nome} inválido.`);
  return valor;
}

// Valida a data de validade antes de enviá-la ao PostgreSQL.
function validarData(valor) {
  if (valor === null || valor === '') return null;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw erroHttp(400, 'Validade inválida.');
  const data = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(data.valueOf()) || data.toISOString().slice(0, 10) !== valor) throw erroHttp(400, 'Validade inválida.');
  return valor;
}

// Verifica campos e itens da proposta e prepara valores para persistência.
function validarOrcamento(body) {
  const status = body?.status;
  if (!statusPermitidos.has(status)) throw erroHttp(400, 'Situação do orçamento inválida.');
  const desconto = validarInteiro(body.desconto_centavos, 'Desconto', 9_000_000_000_000);
  const observacoes = typeof body.observacoes === 'string' ? body.observacoes.trim() : '';
  if (observacoes.length > 4000) throw erroHttp(400, 'As observações devem ter até 4.000 caracteres.');
  if (!Array.isArray(body.itens) || body.itens.length > 100) throw erroHttp(400, 'Envie no máximo 100 itens.');
  const itens = body.itens.map((item, indice) => {
    const descricao = typeof item.descricao === 'string' ? item.descricao.trim() : '';
    if (!descricao || descricao.length > 200) throw erroHttp(400, `Descrição inválida no item ${indice + 1}.`);
    if (!categorias.has(item.categoria)) throw erroHttp(400, `Categoria inválida no item ${indice + 1}.`);
    if (!unidades.has(item.unidade)) throw erroHttp(400, `Unidade inválida no item ${indice + 1}.`);
    const quantidade = validarInteiro(item.quantidade_milesimos, `Quantidade do item ${indice + 1}`, 1_000_000_000);
    if (!quantidade) throw erroHttp(400, `Quantidade inválida no item ${indice + 1}.`);
    const valor = validarInteiro(item.valor_unitario_centavos, `Valor do item ${indice + 1}`, 9_000_000_000_000);
    return { descricao, categoria: item.categoria, unidade: item.unidade, quantidade_milesimos: quantidade, valor_unitario_centavos: valor };
  });
  const subtotal = itens.reduce((total, item) => total + Math.round(item.quantidade_milesimos * item.valor_unitario_centavos / 1000), 0);
  if (!Number.isSafeInteger(subtotal)) throw erroHttp(400, 'O total do orçamento é muito alto.');
  if (desconto > subtotal) throw erroHttp(400, 'O desconto não pode ser maior que o subtotal.');
  if (status !== 'rascunho' && (!itens.length || subtotal - desconto <= 0)) throw erroHttp(400, 'Inclua itens com valor antes de tirar o orçamento do rascunho.');
  return { status, desconto_centavos: desconto, validade: validarData(body.validade), observacoes, itens, subtotal_centavos: subtotal, total_centavos: subtotal - desconto };
}

// Carrega o orçamento e seus itens respeitando o projeto e a empresa.
async function carregarOrcamento(db, projetoId, marcenariaId) {
  const cabecalho = await db.query(`SELECT o.*, p.movel, p.uso, c.nome AS cliente_nome, c.telefone
    FROM orcamentos o JOIN projetos p ON p.id = o.projeto_id JOIN clientes c ON c.id = p.cliente_id
    WHERE o.projeto_id = $1 AND o.marcenaria_id=$2 AND p.marcenaria_id=$2 AND c.marcenaria_id=$2`, [projetoId,marcenariaId]);
  if (!cabecalho.rows[0]) return null;
  const itens = (await db.query('SELECT * FROM orcamento_itens WHERE orcamento_id = $1 ORDER BY ordem, id', [cabecalho.rows[0].id])).rows;
  const subtotal = itens.reduce((total, item) => total + Math.round(Number(item.quantidade_milesimos) * Number(item.valor_unitario_centavos) / 1000), 0);
  return { ...cabecalho.rows[0], itens, subtotal_centavos: subtotal, total_centavos: subtotal - Number(cabecalho.rows[0].desconto_centavos) };
}

const { protegerOrigemPainel } = require('./seguranca');

// Registra leitura e salvamento do orçamento; as alterações relacionadas usam uma transação.
function registrarOrcamentos(app, banco, rota) {
  app.use(['/api/orcamentos', '/api/projetos'], protegerOrigemPainel);
  app.get('/api/projetos/:id/orcamento', rota(async (req, res) => {
    const projetoId = validarId(req.params.id);
    const projeto = (await banco.query(`SELECT p.id, p.movel, p.uso, c.nome AS cliente_nome, c.telefone
      FROM projetos p JOIN clientes c ON c.id = p.cliente_id
      WHERE p.id = $1 AND p.marcenaria_id=$2 AND c.marcenaria_id=$2`, [projetoId,req.marcenaria.id])).rows[0];
    if (!projeto) throw erroHttp(404, 'Projeto não encontrado.');
    res.json({ projeto, orcamento: await carregarOrcamento(banco, projetoId,req.marcenaria.id) });
  }));
  app.post('/api/projetos/:id/orcamento', rota(async (req, res) => {
    const projetoId = validarId(req.params.id);
    const db = await banco.connect();
    try {
      await db.query('BEGIN');
      if (!(await db.query('SELECT id FROM projetos WHERE id = $1 AND marcenaria_id=$2 FOR UPDATE', [projetoId,req.marcenaria.id])).rows[0]) throw erroHttp(404, 'Projeto não encontrado.');
      const criado = await db.query(`INSERT INTO orcamentos (projeto_id,marcenaria_id) VALUES ($1,$2)
        ON CONFLICT (projeto_id) DO NOTHING RETURNING id`, [projetoId,req.marcenaria.id]);
      if (!criado.rows[0]) throw erroHttp(409, 'Este projeto já possui orçamento. Recarregue a ficha.');
      await db.query('COMMIT');
      res.status(201).json({ orcamento: await carregarOrcamento(banco, projetoId,req.marcenaria.id) });
    } catch (erro) { await db.query('ROLLBACK'); throw erro; } finally { db.release(); }
  }));
  app.put('/api/orcamentos/:id', rota(async (req, res) => {
    const id = validarId(req.params.id);
    const versao = validarInteiro(req.body?.versao, 'Versão', 2_000_000_000);
    if (!versao) throw erroHttp(400, 'Versão inválida.');
    const dados = validarOrcamento(req.body);
    const db = await banco.connect();
    try {
      await db.query('BEGIN');
      const atualizado = await db.query(`UPDATE orcamentos SET status=$1, desconto_centavos=$2, validade=$3,
        observacoes=$4, versao=versao+1, atualizado_em=CURRENT_TIMESTAMP WHERE id=$5 AND versao=$6 AND marcenaria_id=$7 RETURNING projeto_id`,
        [dados.status, dados.desconto_centavos, dados.validade, dados.observacoes, id, versao,req.marcenaria.id]);
      if (!atualizado.rows[0]) {
        const existe = (await db.query('SELECT id FROM orcamentos WHERE id=$1 AND marcenaria_id=$2', [id,req.marcenaria.id])).rows[0];
        throw erroHttp(existe ? 409 : 404, existe ? 'O orçamento foi alterado em outra tela. Recarregue antes de salvar.' : 'Orçamento não encontrado.');
      }
      await db.query('DELETE FROM orcamento_itens WHERE orcamento_id=$1', [id]);
      for (let i = 0; i < dados.itens.length; i++) {
        const item = dados.itens[i];
        await db.query(`INSERT INTO orcamento_itens
          (orcamento_id, descricao, categoria, quantidade_milesimos, unidade, valor_unitario_centavos, ordem)
          VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, item.descricao, item.categoria, item.quantidade_milesimos, item.unidade, item.valor_unitario_centavos, i]);
      }
      await db.query('COMMIT');
      res.json({ orcamento: await carregarOrcamento(banco, atualizado.rows[0].projeto_id,req.marcenaria.id) });
    } catch (erro) { await db.query('ROLLBACK'); throw erro; } finally { db.release(); }
  }));
}

module.exports = { registrarOrcamentos, validarOrcamento, carregarOrcamento };
