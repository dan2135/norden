const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extrairDadosProjeto } = require('./extracao');
const { validarExtracao } = require('./dados-projeto');

test('extração impõe valor e evidência pelo schema e não reapresenta dados antigos', async () => {
  const historico = [
    { role: 'user', content: 'mesa branca' },
    { role: 'assistant', content: 'Qual móvel deseja?' },
    { role: 'user', content: 'gaveteiro' },
  ];
  const esperado = { movel: { valor: 'gaveteiro', trecho: 'gaveteiro' } };
  const extraido = await extrairDadosProjeto(historico, async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.format.type, 'object');
    assert.deepEqual(body.format.properties.movel.anyOf[1].required, ['valor', 'trecho']);
    assert.equal(body.format.properties.largura_cm.anyOf[1].properties.valor.type, 'number');
    assert.equal(body.messages.length, 2);
    assert.deepEqual(JSON.parse(body.messages[1].content), { pergunta_anterior: 'Qual móvel deseja?', mensagem_cliente: 'gaveteiro' });
    return { ok: true, json: async () => ({ message: { content: JSON.stringify(esperado) } }) };
  });
  assert.equal(validarExtracao(extraido, historico).dados.movel, 'gaveteiro');
});

test('saudação não solicita extração nem produz pendências', async () => {
  for (const content of ['ola', 'Olá!', 'oi', 'bom dia']) {
    const h = [{ role: 'user', content }];
    const dados = await extrairDadosProjeto(h, () => { throw new Error('Não deve chamar IA'); });
    assert.deepEqual(validarExtracao(dados, h).pendencias, []);
    assert.ok(Object.values(dados).every(v => v === null));
  }
});

test('local e característica em continuação preservam literal e não renomeiam móvel', async () => {
  for (const [content, local, detalhe] of [
    ['no meu ecritorio quero que ele tenha rodinha', 'ecritorio', 'rodinha'],
    ['no meu escritório quero que ele tenha rodinha', 'escritório', 'rodinha'],
    ['na sala quero que ele tenha portas', 'sala', 'portas'],
    ['na minha cozinha quero que ela tenha três gavetas', 'cozinha', 'três gavetas'],
  ]) {
    const h = [{ role: 'assistant', content: 'Seu gaveteiro vai no quarto ou escritório?' }, { role: 'user', content }];
    const dados = await extrairDadosProjeto(h, () => { throw new Error('Regra explícita não depende da IA'); });
    const validado = validarExtracao(dados, h);
    assert.equal(validado.dados.movel, null);
    assert.equal(validado.dados.uso, local);
    assert.equal(validado.dados.detalhes, detalhe);
    assert.deepEqual(validado.pendencias, []);
  }
});

test('JSON malformado não é aceito; falha do Ollama continua sendo erro', async () => {
  const h = [{ role: 'user', content: 'gaveteiro' }];
  assert.equal(await extrairDadosProjeto(h, async () => ({ ok: true, json: async () => ({ message: { content: 'inválido' } }) })), null);
  await assert.rejects(extrairDadosProjeto(h, async () => ({ ok: false })), /Erro ao extrair/);
});

test('regressão com Ollama real: frases da tela, medida e informação não informada', { skip: !process.env.TEST_OLLAMA }, async () => {
  const casos = [
    ['quero fazer um gaveteiro', 'gaveteiro'],
    ['gaveteiro', 'gaveteiro'],
    ['gaveta', 'gaveta'],
    ['quyero fazer um movel com gavetas~', 'movel com gavetas'],
  ];
  for (const [content, movel] of casos) {
    const h = [{ role: 'assistant', content: 'Não confirmei esse dado. Pode informar o móvel desejado de forma direta?' }, { role: 'user', content }];
    const resultado = validarExtracao(await extrairDadosProjeto(h), h);
    assert.equal(resultado.dados.movel, movel, content);
    assert.equal(resultado.dados.uso, null, content);
    assert.deepEqual(resultado.pendencias, [], content);
  }
  for (const [content, campo, esperado] of [
    ['largura de 1,20 m', 'largura_cm', 120],
    ['quero madeirado', 'acabamento', 'madeirado'],
    ['não quero branco', 'acabamento', null],
  ]) {
    const h = [{ role: 'user', content }];
    assert.equal(validarExtracao(await extrairDadosProjeto(h), h).dados[campo], esperado, content);
  }
});
