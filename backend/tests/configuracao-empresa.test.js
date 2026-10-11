/**
 * Garante que o onboarding da empresa peça nome, ramo e descrição do trabalho antes do primeiro uso.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { validarConfiguracao } = require('../configuracao-empresa');

test('valida configuração inicial da empresa', () => {
  const dados = validarConfiguracao({ nome:'  Norden  ', segmento:'servicos', atividade:'  Assistência técnica e instalação  ' });
  assert.deepEqual(dados, { nome:'Norden', segmento:'servicos', atividade:'Assistência técnica e instalação', horarios_atendimento:'', servicos:'', personalidade_suzy:'profissional' });
});

test('guarda serviços e tom de atendimento escolhidos pela empresa', () => {
  const dados = validarConfiguracao({ nome:'Norden', segmento:'servicos', atividade:'Instalação', servicos:'Instalação e manutenção', personalidade_suzy:'direta' });
  assert.equal(dados.servicos, 'Instalação e manutenção');
  assert.equal(dados.personalidade_suzy, 'direta');
});

test('exige atividade da empresa para liberar a configuração', () => {
  assert.throws(() => validarConfiguracao({ nome:'Norden', segmento:'servicos', atividade:'' }), /empresa trabalha/i);
});
