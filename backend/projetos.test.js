const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarId, validarTelefone, selecionarProjeto, historicoProjeto } = require('./projetos');

test('valida telefone e identificador de projeto', () => {
  assert.equal(validarId('12'), 12);
  for (const id of [0, -1, 'abc', '1.5', null, undefined]) assert.throws(() => validarId(id));
  assert.equal(validarTelefone('11988888888'), '11988888888');
  assert.throws(() => validarTelefone(''));
});
test('não escolhe silenciosamente entre vários projetos', async () => {
  await assert.rejects(selecionarProjeto({ query: async () => ({ rows: [{ id: 1 }, { id: 2 }] }) }, 1), { status: 409 });
});
test('projeto explícito precisa pertencer ao cliente', async () => {
  const db = { query: async (sql, valores) => {
    assert.match(sql, /id = \$1 AND cliente_id = \$2/);
    assert.deepEqual(valores, [10, 2, 7]);
    return { rows: [] };
  } };
  await assert.rejects(selecionarProjeto(db, 2, 10, 7), { status: 404 });
});
test('histórico sempre filtra cliente e projeto e desempata por id', async () => {
  await historicoProjeto({ query: async (sql, valores) => {
    assert.match(sql, /cliente_id = \$1 AND projeto_id = \$2 AND marcenaria_id=\$3 ORDER BY criado_em ASC, id ASC/);
    assert.deepEqual(valores, [2, 10, 7]);
    return { rows: [] };
  } }, 2, 10, 7);
});
