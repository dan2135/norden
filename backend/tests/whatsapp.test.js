/**
 * Testes do webhook WhatsApp sem chamar a Meta.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  configurarWhatsApp,
  configurarEmbeddedSignup,
  mensagensDoWebhook,
  resolverEmpresaWhatsApp,
  validarConfiguracaoWhatsApp,
  validarConclusaoEmbeddedSignup,
  concluirEmbeddedSignup,
} = require('../whatsapp');

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

test('configuração do embedded signup lê credenciais da Meta', () => {
  const config = configurarEmbeddedSignup({
    META_APP_ID:'1532554661892738',
    META_APP_SECRET:'segredo',
    META_EMBEDDED_SIGNUP_CONFIG_ID:'config-123',
    WHATSAPP_API_VERSION:'v26.0',
  });
  assert.deepEqual(config, { appId:'1532554661892738', appSecret:'segredo', configId:'config-123', apiVersion:'v26.0' });
});

test('valida conclusão do embedded signup', () => {
  assert.deepEqual(validarConclusaoEmbeddedSignup({
    code:' abc ',
    waba_id:'waba 987654',
    phone_number_id:'phone 123456',
  }), { code:'abc', wabaId:'987654', phoneNumberId:'123456' });
  assert.throws(() => validarConclusaoEmbeddedSignup({}), /Autorização da Meta/i);
});

test('conclui embedded signup e salva WhatsApp da empresa', async () => {
  const chamadas = [];
  const consultar = async (url, opcoes = {}) => {
    chamadas.push({ url, method: opcoes.method || 'GET', body: opcoes.body ? JSON.parse(opcoes.body) : null });
    if (url.includes('/oauth/access_token')) return { ok:true, json:async () => ({ access_token:'token-meta' }) };
    if (url.includes('/123456789?fields=')) return { ok:true, json:async () => ({ id:'123456789', display_phone_number:'+55 11 99999-0000' }) };
    if (url.includes('/987654/subscribed_apps')) return { ok:true, json:async () => ({ success:true }) };
    throw new Error(`Chamada inesperada: ${url}`);
  };
  const banco = { async query(sql, params) {
    assert.match(sql, /INSERT INTO whatsapp_configuracoes/);
    assert.deepEqual(params, [5, '+55 11 99999-0000', '987654', '123456789', 'token-meta', 'v26.0']);
    return { rows:[{ numero:params[1], waba_id:params[2], phone_number_id:params[3], api_version:params[5], ativo:true, access_token:params[4] }] };
  } };
  const whatsapp = await concluirEmbeddedSignup({
    banco,
    empresa:{ id:5 },
    body:{ code:'code-meta', waba_id:'987654', phone_number_id:'123456789' },
    consultar,
    env:{ META_APP_ID:'app', META_APP_SECRET:'secret', META_EMBEDDED_SIGNUP_CONFIG_ID:'config', WHATSAPP_API_VERSION:'v26.0' },
  });
  assert.equal(chamadas.length, 3);
  assert.equal(whatsapp.configurado, true);
  assert.equal(whatsapp.phone_number_id, '123456789');
  assert.equal(whatsapp.access_token, undefined);
});
