const test = require('node:test');
const assert = require('node:assert/strict');
const { diagnosticarBanco } = require('../diagnostico-banco');
test('AggregateError sem mensagem produz diagnóstico útil e omite dados privados', () => {
  const erro = new AggregateError([Object.assign(new Error('senha privada'), {code:'ECONNREFUSED'})], '');
  const texto = diagnosticarBanco(erro);
  assert.match(texto, /ECONNREFUSED/);
  assert.match(texto, /NORDEN_DEMO/);
  assert(!texto.includes('senha privada'));
});
test('orienta configuração, autenticação e certificado sem copiar erro remoto', () => {
  for (const code of ['DB_CONFIG_AUSENTE','28P01','SELF_SIGNED_CERT_IN_CHAIN']) {
    const texto = diagnosticarBanco({code,message:'postgresql://segredo'});
    assert(texto.includes(code)); assert(!texto.includes('postgresql://'));
  }
  assert(diagnosticarBanco(new Error()).length > 40);
});
