/**
 * Testes do webhook WhatsApp sem chamar a Meta.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { configurarWhatsApp, mensagensDoWebhook } = require('../whatsapp');

test('configuração do WhatsApp lê token, número e versão', () => {
  const config = configurarWhatsApp({ WHATSAPP_TOKEN:'x', WHATSAPP_PHONE_NUMBER_ID:'123', WHATSAPP_VERIFY_TOKEN:'verifica', WHATSAPP_API_VERSION:'v25.0' });
  assert.equal(config.token, 'x');
  assert.equal(config.phoneNumberId, '123');
  assert.equal(config.verifyToken, 'verifica');
  assert.equal(config.apiVersion, 'v25.0');
});

test('extrai somente mensagens de texto do webhook da Meta', () => {
  const mensagens = mensagensDoWebhook({ entry:[{ changes:[{ value:{ messages:[
    { id:'wamid.1', from:'5511999999999', type:'text', text:{ body:'Oi' } },
    { id:'wamid.2', from:'5511888888888', type:'image', image:{} },
  ] } }] }] });
  assert.deepEqual(mensagens, [{ id:'wamid.1', de:'5511999999999', texto:'Oi' }]);
});
