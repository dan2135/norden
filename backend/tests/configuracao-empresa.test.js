/**
 * Garante que o onboarding da empresa peça nome, ramo e descrição do trabalho antes do primeiro uso.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { validarConfiguracao } = require('../configuracao-empresa');

test('valida configuração inicial da empresa', () => {
  const dados = validarConfiguracao({ nome:'  Norden  ', segmento:'servicos', atividade:'  Assistência técnica e instalação  ' });
  assert.deepEqual(dados, { nome:'Norden', segmento:'servicos', atividade:'Assistência técnica e instalação' });
});

test('exige atividade da empresa para liberar a configuração', () => {
  assert.throws(() => validarConfiguracao({ nome:'Norden', segmento:'servicos', atividade:'' }), /empresa trabalha/i);
});
