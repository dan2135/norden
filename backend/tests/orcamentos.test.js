/**
 * Testes de regressão: total do orçamento é calculado no servidor; rejeita desconto maior que subtotal; rejeita preço, quantidade e categorias inválidos.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { validarOrcamento } = require('../orcamentos');

const valido = () => ({ status: 'rascunho', desconto_centavos: 500, validade: '2026-12-31', observacoes: 'Prazo a combinar', itens: [
  { descricao: 'MDF', categoria: 'material', quantidade_milesimos: 1500, unidade: 'm2', valor_unitario_centavos: 10000 },
] });

test('total do orçamento é calculado no servidor', () => {
  const dados = validarOrcamento(valido());
  assert.equal(dados.subtotal_centavos, 15000);
  assert.equal(dados.total_centavos, 14500);
});

test('rejeita desconto maior que subtotal', () => {
  const entrada = valido(); entrada.desconto_centavos = 15001;
  assert.throws(() => validarOrcamento(entrada), /desconto não pode/i);
});

test('rejeita preço, quantidade e categorias inválidos', () => {
  for (const alteracao of [
    { quantidade_milesimos: 0 }, { valor_unitario_centavos: -1 }, { categoria: 'inventada' }, { unidade: 'kg' },
  ]) {
    const entrada = valido(); Object.assign(entrada.itens[0], alteracao);
    assert.throws(() => validarOrcamento(entrada));
  }
});

test('não marca orçamento vazio como pronto ou aprovado', () => {
  for (const status of ['pronto', 'aprovado']) assert.throws(() => validarOrcamento({ ...valido(), status, itens: [], desconto_centavos: 0 }), /inclua itens/i);
});

test('valida data real e limites de texto', () => {
  assert.throws(() => validarOrcamento({ ...valido(), validade: '2026-02-30' }), /validade inválida/i);
  assert.throws(() => validarOrcamento({ ...valido(), observacoes: 'x'.repeat(4001) }), /4\.000/);
});
