/**
 * Testes de regressão: converte valor brasileiro para centavos sem usar ponto flutuante na API; converte quantidade para milésimos e rejeita zero; calcula item e formata moeda.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { campoParaCentavos, campoParaMilesimos, formatarDinheiro, totalItem } from '../src/orcamento-utils.js';

test('converte valor brasileiro para centavos sem usar ponto flutuante na API', () => {
  assert.equal(campoParaCentavos('123,45'), 12345);
  assert.equal(campoParaCentavos('0.99'), 99);
  assert.equal(campoParaCentavos('12,345'), null);
  assert.equal(campoParaCentavos('-1'), null);
});

test('converte quantidade para milésimos e rejeita zero', () => {
  assert.equal(campoParaMilesimos('1,5'), 1500);
  assert.equal(campoParaMilesimos('0,125'), 125);
  assert.equal(campoParaMilesimos('0'), null);
});

test('calcula item e formata moeda', () => {
  assert.equal(totalItem({ quantidade: '1,5', valor: '100,00' }), 15000);
  assert.match(formatarDinheiro(15000), /150,00/);
});
