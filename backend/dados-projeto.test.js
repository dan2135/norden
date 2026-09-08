const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarExtracao, medidaExplicita } = require('./dados-projeto');
const validar = (texto, campo, valor, trecho = texto) => validarExtracao({ [campo]: { valor, trecho } }, [{ role: 'user', content: texto }]);

test('converte metros, centímetros e milímetros com decimal brasileiro', () => {
  for (const [texto, cm] of [['largura de 1,20 m', 120], ['120 cm de largura', 120], ['largura: 1200 mm', 120], ['largura 12.5 cm', 12.5]]) {
    assert.equal(validar(texto, 'largura_cm', cm).dados.largura_cm, cm);
  }
});
test('rejeita dimensões ambíguas, intervalos, números negativos e unidades ausentes', () => {
  for (const texto of ['120x35', '1,40 por 80', 'largura 120', 'largura -120 cm', '-120 cm de largura', 'largura 120 cm a 150 cm', 'largura 0 cm', 'largura 12000 m']) {
    assert.equal(validar(texto, 'largura_cm', 120).dados.largura_cm, null, texto);
  }
});
test('valida dimensão correta e conversão, sem aceitar número inventado', () => {
  assert.equal(validar('altura de 120 cm', 'largura_cm', 120).dados.largura_cm, null);
  assert.equal(validar('largura de 1,20 m', 'largura_cm', 1.2).dados.largura_cm, null);
  for (const valor of ['120', NaN, Infinity, {}, true]) assert.equal(validar('largura de 120 cm', 'largura_cm', valor).dados.largura_cm, null);
});
test('resposta curta exige unidade e pergunta anterior com uma única dimensão', () => {
  assert.equal(medidaExplicita('1,2 m', 'largura_cm', 'Qual a largura?'), 120);
  assert.equal(medidaExplicita('120', 'largura_cm', 'Qual a largura?'), null);
  assert.equal(medidaExplicita('120 cm', 'largura_cm', 'Qual a largura e altura?'), null);
});
test('texto precisa existir na evidência literal do cliente', () => {
  assert.equal(validar('Quero madeirado', 'acabamento', 'madeirado').dados.acabamento, 'madeirado');
  assert.equal(validar('Quero madeirado', 'acabamento', 'carvalho').dados.acabamento, null);
  assert.equal(validar('Quero branco', 'acabamento', 'branco', 'Branco inventado').dados.acabamento, null);
});
test('sugestão do atendente e histórico antigo não sustentam uma atualização', () => {
  const historico = [{ role: 'user', content: 'Quero branco' }, { role: 'assistant', content: 'Pode ser carvalho?' }, { role: 'user', content: 'Qual o preço?' }];
  for (const [valor, trecho] of [['carvalho', 'Pode ser carvalho?'], ['branco', 'Quero branco']]) {
    assert.equal(validarExtracao({ acabamento: { valor, trecho } }, historico).dados.acabamento, null);
  }
});
test('negações, hipóteses e alternativas pedem confirmação', () => {
  for (const texto of ['Não quero branco', 'Talvez branco', 'Branco ou preto', 'Acho que branco']) {
    assert.deepEqual(validar(texto, 'acabamento', 'branco').pendencias, ['acabamento']);
  }
});
test('JSON inválido, objetos e textos excessivos não entram no banco', () => {
  for (const valor of [null, [], 'texto', 4]) assert.ok(validarExtracao(valor, [{ role: 'user', content: 'oi' }]).pendencias.length);
  assert.equal(validar('mesa', 'movel', {}).dados.movel, null);
  assert.equal(validar('a'.repeat(101), 'movel', 'a'.repeat(101)).dados.movel, null);
});
test('campos ausentes preservam dados; chaves inesperadas são ignoradas', () => {
  const resultado = validarExtracao({ status: 'aprovado', largura_cm: null }, [{ role: 'user', content: 'Olá' }]);
  assert.equal(resultado.dados.largura_cm, null);
  assert.equal('status' in resultado.dados, false);
  assert.deepEqual(resultado.pendencias, []);
});
test('medida ambígua omitida pelo modelo também pede confirmação', () => {
  assert.deepEqual(validarExtracao({}, [{ role: 'user', content: '120x35' }]).pendencias, ['medidas']);
});
