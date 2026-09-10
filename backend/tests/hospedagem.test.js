/** Regressões de publicação: porta, origem pública e bloqueio de origens não autorizadas. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { configuracaoHospedagem } = require('../hospedagem');
const { protegerOrigemPainel } = require('../seguranca');

test('mantém rede local e aceita a porta e origem HTTPS da hospedagem', () => {
  assert.equal(configuracaoHospedagem({}).host, '127.0.0.1');
  const config = configuracaoHospedagem({ NODE_ENV: 'production', PORT: '10000', FRONTEND_URL: 'https://norden-teste.onrender.com' });
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.porta, 10000);
  assert.deepEqual(config.origens, ['https://norden-teste.onrender.com']);
  assert.throws(() => configuracaoHospedagem({ NODE_ENV: 'production' }));
  assert.throws(() => configuracaoHospedagem({ PORT: 'abc' }));
  assert.throws(() => configuracaoHospedagem({ NODE_ENV: 'production', FRONTEND_URL: 'http://exemplo.com' }));
});

test('painel aceita endereço público autorizado e recusa domínio semelhante e localhost', () => {
  const origem = 'https://norden-teste.onrender.com';
  for (const [entrada, permitido] of [[origem, true], [origem + '.evil.test', false], ['http://localhost:5176', false]]) {
    let passou = false, status;
    const req = { get: () => entrada, app: { locals: { origensPermitidas: [origem] } } };
    const res = { status(code) { status = code; return this; }, json() {} };
    protegerOrigemPainel(req, res, () => { passou = true; });
    assert.equal(passou, permitido);
    if (!permitido) assert.equal(status, 403);
  }
});
