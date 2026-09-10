/**
 * Testes de regressão: Suzy usa a empresa do atendimento e preserva a coleta; primeiro pedido recebe apresentação; continuação não repete.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { analisarMensagem, responder } = require('../coleta');

test('Suzy usa a empresa do atendimento e preserva a coleta', () => {
  const projeto = { movel: 'gaveteiro', uso: 'escritório' };
  for (const empresa of ['RF', 'Marcenaria principal']) {
    const analise = analisarMensagem('oi', projeto, {});
    const resposta = responder(analise, projeto, {}, { marcenaria: empresa });
    assert.ok(resposta.startsWith(`Oi, eu sou a Suzy, assistente virtual da ${empresa}.`));
    assert.match(resposta, /largura desejada/);
  }
});

test('primeiro pedido recebe apresentação; continuação não repete', () => {
  const a = analisarMensagem('quero um gaveteiro', {}, {});
  assert.match(responder(a, {}, {}, { marcenaria: 'RF', primeiroContato: true }), /Suzy/);
  const projeto = { movel: 'gaveteiro' };
  const b = analisarMensagem('no escritório', projeto, {});
  assert.doesNotMatch(responder(b, projeto, {}, { marcenaria: 'RF' }), /Suzy/);
});
