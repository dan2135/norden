/**
 * Testes de regressão: gera consumo com perdas declaradas e ferragens coerentes; não estima projeto sem as três dimensões; usa preço do catálogo, arredonda para embalagens e aponta faltantes.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { validarMaterial, gerarConsumo, montarEstimativa } = require('../estimativa');

const projeto = { largura_cm: 50, altura_cm: 80, profundidade_cm: 45, movel: 'Gaveteiro com 3 gavetas', detalhes: '' };

test('gera consumo com perdas declaradas e ferragens coerentes', () => {
  const r = gerarConsumo(projeto);
  assert.ok(r.consumo.find(i => i.tipo === 'chapa').quantidade_milesimos > 0);
  assert.equal(r.consumo.find(i => i.tipo === 'corredica').quantidade_milesimos, 3000);
  assert.match(r.suposicoes.join(' '), /15%.*3 gaveta/i);
});

test('não estima projeto sem as três dimensões', () => {
  assert.throws(() => gerarConsumo({ ...projeto, profundidade_cm: null }), /largura, altura e profundidade/i);
});

test('usa preço do catálogo, arredonda para embalagens e aponta faltantes', () => {
  const catalogo = [{ id:1, tipo:'chapa', descricao:'MDF 18', fornecedor:'Léo', unidade_consumo:'m2', rendimento_milesimos:5087, preco_centavos:35000, ativo:true, atualizado_em:new Date() }];
  const r = montarEstimativa(projeto, catalogo);
  assert.ok(r.itens[0].quantidade_milesimos >= 1000);
  assert.equal(r.itens[0].valor_unitario_centavos, 35000);
  assert.ok(r.faltantes.includes('fita'));
  assert.ok(r.faltantes.includes('corredica'));
});

test('valida preço e rendimento cadastrados', () => {
  const base = { tipo:'chapa', descricao:'MDF', fornecedor:'Léo', unidade_consumo:'m2', rendimento_milesimos:5087, preco_centavos:30000 };
  assert.deepEqual(validarMaterial(base).preco_centavos, 30000);
  assert.equal(validarMaterial({ ...base, especificacoes:'  Chapa 2,75 × 1,85 m  ' }).especificacoes, 'Chapa 2,75 × 1,85 m');
  assert.throws(() => validarMaterial({ ...base, preco_centavos:-1 }), /preço inválido/i);
  assert.throws(() => validarMaterial({ ...base, rendimento_milesimos:0 }), /rendimento inválido/i);
  assert.throws(() => validarMaterial({ ...base, especificacoes:'x'.repeat(501) }), /especificações/i);
});
