/**
 * Testes do webhook WhatsApp sem chamar a Meta.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { configurarWhatsApp, mensagensDoWebhook, resolverEmpresaWhatsApp, validarConfiguracaoWhatsApp } = require('../whatsapp');

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
  ], metadata:{ phone_number_id:'987654321', display_phone_number:'5511999990000' } } }] }] });
  assert.deepEqual(mensagens, [{ id:'wamid.1', de:'5511999999999', texto:'Oi', phoneNumberId:'987654321', displayPhoneNumber:'5511999990000' }]);
});

test('resolve empresa pelo número que recebeu a mensagem', async () => {
  const banco = { async query(sql, params) {
    assert.match(sql, /whatsapp_configuracoes/);
    assert.deepEqual(params, ['987654321']);
    return { rows:[{ id:7, nome:'Empresa teste', slug:'empresa-teste', segmento:'servicos', atividade:'Instalação', papel:'administrador',
      whatsapp_token:'token-meta', whatsapp_phone_number_id:'987654321', whatsapp_api_version:'v25.0' }] };
  } };
  const empresa = await resolverEmpresaWhatsApp(banco, configurarWhatsApp({}), '987654321');
  assert.equal(empresa.id, 7);
  assert.deepEqual(empresa.whatsapp, { token:'token-meta', phoneNumberId:'987654321', apiVersion:'v25.0' });
});

test('valida configuração por empresa sem expor token salvo', () => {
  assert.deepEqual(validarConfiguracaoWhatsApp({
    numero:'+55 11 99999-0000',
    phone_number_id:' 123456789 ',
    waba_id:'waba 9988',
    access_token:'EAAB-token',
    api_version:'v25.0',
    ativo:true,
  }), { numero:'+55 11 99999-0000', phoneNumberId:'123456789', wabaId:'9988', accessToken:'EAAB-token', apiVersion:'v25.0', ativo:true });
  assert.throws(() => validarConfiguracaoWhatsApp({ phone_number_id:'abc' }), /Phone Number ID/i);
});
