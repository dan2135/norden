const test = require('node:test');
const assert = require('node:assert/strict');
const { criarHashSenha, conferirSenha, validarDocumento } = require('../auth');

test('senha é armazenada com scrypt e validada sem texto puro', async () => {
  const senha = 'uma-senha-forte-123';
  const hash = await criarHashSenha(senha);
  assert.match(hash, /^scrypt\$16384\$8\$1\$/);
  assert.equal(hash.includes(senha), false);
  assert.equal(await conferirSenha(senha, hash), true);
  assert.equal(await conferirSenha('senha-incorreta', hash), false);
});

test('hash adulterado é rejeitado sem derrubar a autenticação', async () => {
  assert.equal(await conferirSenha('qualquer-senha', 'registro-invalido'), false);
});

test('valida CPF e CNPJ pelos dígitos verificadores', () => {
  assert.equal(validarDocumento('529.982.247-25'), '52998224725');
  assert.equal(validarDocumento('11.222.333/0001-81'), '11222333000181');
  assert.equal(validarDocumento('12.ABC.345/01DE-35'), '12ABC34501DE35');
  assert.throws(() => validarDocumento('111.111.111-11'), /válido/);
  assert.throws(() => validarDocumento('11.222.333/0001-80'), /inválido/);
});
