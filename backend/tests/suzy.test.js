/**
 * Testes de regressão: Suzy conversa sem expor nome interno da empresa; primeiro pedido recebe apresentação; continuação não repete.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { analisarMensagem, responder } = require('../coleta');

test('saudação é neutra e não pula para pergunta técnica', () => {
  const projeto = { movel: 'gaveteiro', uso: 'escritório' };
  for (const empresa of ['RF', 'Marcenaria principal']) {
    const analise = analisarMensagem('oi', projeto, {});
    const resposta = responder(analise, projeto, {}, { marcenaria: empresa });
    assert.equal(resposta, 'Oi! Sou a Suzy, atendente virtual. Como posso ajudar hoje?');
    assert.doesNotMatch(resposta, new RegExp(empresa));
    assert.doesNotMatch(resposta, /largura|altura|profundidade/);
  }
});

test('primeiro pedido recebe apresentação; continuação não repete', () => {
  const a = analisarMensagem('quero um gaveteiro', {}, {});
  const primeira = responder(a, {}, {}, { marcenaria: 'RF', primeiroContato: true });
  assert.match(primeira, /Suzy, atendente virtual/);
  assert.doesNotMatch(primeira, /RF/);
  const projeto = { movel: 'gaveteiro' };
  const b = analisarMensagem('no escritório', projeto, {});
  assert.doesNotMatch(responder(b, projeto, {}, { marcenaria: 'RF' }), /Suzy/);
});

test('pedido inicial conversa antes de pedir medidas', () => {
  const a = analisarMensagem('gostaria de fazer uma bancada', {}, {});
  const resposta = responder(a, {}, {}, { marcenaria: 'Empresa principal', primeiroContato: true });
  assert.match(resposta, /onde isso vai ser usado|ideia do projeto/);
  assert.doesNotMatch(resposta, /Empresa principal|largura desejada/);
});

test('ambiente loja é entendido sem repetir a mesma pergunta', () => {
  const projeto = { movel: 'bancada', coleta: { pergunta: 'uso' } };
  const a = analisarMensagem('para minha loja', projeto, {});
  const resposta = responder(a, projeto, {}, {});
  assert.equal(a.dados.uso, 'loja');
  assert.doesNotMatch(resposta, /onde isso vai ser usado/);
  assert.match(resposta, /cor|acabamento|material/);
});

test('não inicia perguntas de medida depois de entender o pedido básico', () => {
  const projeto = { movel:'bancada', uso:'loja' };
  const a = analisarMensagem('madeirado', projeto, {});
  const resposta = responder(a, projeto, {}, {});
  assert.doesNotMatch(resposta, /largura|altura|profundidade/);
  assert.match(resposta, /Como posso chamar/);
});
