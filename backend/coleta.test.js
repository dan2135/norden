/**
 * Testes de regressão: sequência das capturas: não volta ao móvel; confirma todas as medidas em uma resposta; ambiente e características separados; nome e acabamento persistem; medidas explícitas, conversões e correção de uma dimensão preservam as outras.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analisarMensagem, complementarComIA, responder } = require('./coleta');

function conversa(projeto = {}, cliente = {}) {
  return texto => {
    const a = analisarMensagem(texto, projeto, cliente);
    const resposta = responder(a, projeto, cliente);
    for (const [k, v] of Object.entries(a.dados)) if (v !== null) projeto[k] = v;
    if (a.nome) cliente.nome = a.nome;
    projeto.coleta = a.estado;
    return { ...a, resposta, projeto: structuredClone(projeto), cliente: { ...cliente } };
  };
}
test('sequência das capturas: não volta ao móvel; confirma todas as medidas em uma resposta', () => {
  const enviar = conversa();
  assert.match(enviar('ola').resposta, /Como posso ajudar hoje/);
  assert.equal(enviar('gostaria de fazer uma gaveteiro').projeto.movel, 'gaveteiro');
  const medidas = enviar('quero que ele tenha 80 de altura uns 30 profundidade e uns 30 de larguda');
  assert.deepEqual(medidas.estado.medidas, { largura_cm: '30', altura_cm: '80', profundidade_cm: '30' });
  assert.equal(medidas.projeto.altura_cm, undefined);
  assert.match(medidas.resposta, /centímetros/);
  const ambiente = enviar('no meu quarto');
  assert.equal(ambiente.projeto.uso, 'quarto');
  assert.doesNotMatch(ambiente.resposta, /móvel desejado|Qual móvel/);
  const confirmado = enviar('sim');
  assert.equal(confirmado.projeto.altura_cm, 80);
  assert.equal(confirmado.projeto.largura_cm, 30);
  assert.equal(confirmado.projeto.profundidade_cm, 30);
});
test('ambiente e características separados; nome e acabamento persistem', () => {
  const enviar = conversa();
  enviar('me chamo Daniel e quero um gaveteiro');
  const a = enviar('no meu ecritorio quero que ele tenha rodinha');
  assert.equal(a.projeto.movel, 'gaveteiro');
  assert.equal(a.projeto.uso, 'escritório');
  assert.equal(a.projeto.detalhes, 'rodinha');
  assert.equal(a.cliente.nome, 'Daniel');
  assert.equal(enviar('branco').projeto.acabamento, 'branco');
});
test('medidas explícitas, conversões e correção de uma dimensão preservam as outras', () => {
  const enviar = conversa({ movel: 'mesa', uso: 'sala' });
  const a = enviar('largura 1,20 m, altura 80 cm e profundidade 300 mm');
  assert.equal(a.projeto.largura_cm, 120);
  assert.equal(a.projeto.altura_cm, 80);
  assert.equal(a.projeto.profundidade_cm, 30);
  const b = enviar('altura de 90 cm');
  assert.equal(b.projeto.altura_cm, 90);
  assert.equal(b.projeto.largura_cm, 120);
});
test('resposta curta usa a dimensão perguntada, mas confirma unidade', () => {
  const enviar = conversa({ movel: 'mesa', uso: 'sala', coleta: { pergunta: 'largura_cm' } });
  assert.match(enviar('120').resposta, /centímetros/);
  assert.equal(enviar('sim, em cm').projeto.largura_cm, 120);
});
test('dimensões adjacentes sem vírgulas não reutilizam o número da anterior', () => {
  const a = analisarMensagem('largura 30 cm altura 80 cm profundidade 40 cm');
  assert.equal(a.dados.largura_cm, 30);
  assert.equal(a.dados.altura_cm, 80);
  assert.equal(a.dados.profundidade_cm, 40);
});
test('pendências sobrevivem à retomada e não passam para outro projeto', () => {
  const um = conversa({ movel: 'mesa' })('largura 1,2');
  const dois = conversa({ movel: 'armário' })('sim');
  assert.equal(dois.projeto.largura_cm, undefined);
  const retomada = conversa(um.projeto)('em metros');
  assert.equal(retomada.projeto.largura_cm, 120);
});
test('não confirma unidade por um sim fora da pergunta adequada', () => {
  const enviar = conversa({ movel: 'mesa' });
  enviar('largura 120');
  assert.match(enviar('não').resposta, /Qual é a unidade/);
  assert.equal(enviar('sim').projeto.largura_cm, undefined);
});
test('intervalos, alternativas, negativos e pares sem ordem não viram medidas', () => {
  for (const texto of ['largura -20 cm', 'largura 20 cm a 30 cm', 'largura 20 ou 30 cm', '120x35', 'largura 12000 m']) {
    const a = analisarMensagem(texto, { largura_cm: 100 });
    assert.equal(a.dados.largura_cm, null, texto);
    assert.ok(a.pendencias.length, texto);
  }
});
test('erros da IA são descartados sem gerar pergunta sobre móvel já conhecido', () => {
  const projeto = { movel: 'gaveteiro', uso: 'quarto' };
  const hist = [{ role: 'user', content: 'no meu quarto' }];
  const a = analisarMensagem('no meu quarto', projeto);
  complementarComIA(a, { movel: { valor: 'gaveteiro', trecho: 'no meu quarto' } }, hist, projeto);
  assert.ok(a.descartados.includes('movel'));
  assert.deepEqual(a.pendencias, []);
  assert.doesNotMatch(responder(a, projeto, {}), /Qual móvel|móvel desejado/);
});
test('nome de ambiente ou característica não substitui móvel confirmado pelo fallback', () => {
  const projeto = { movel: 'gaveteiro' };
  const hist = [{ role: 'user', content: 'rodinha' }];
  const a = complementarComIA(analisarMensagem('rodinha', projeto), { movel: { valor: 'rodinha', trecho: 'rodinha' } }, hist, projeto);
  assert.equal(a.dados.movel, null);
});
test('negação de acabamento não apaga dado; exige decisão explícita', () => {
  const enviar = conversa({ movel: 'mesa', acabamento: 'branco' });
  const a = enviar('não quero branco');
  assert.equal(a.projeto.acabamento, 'branco');
  assert.match(a.resposta, /acabamento/);
  assert.equal(enviar('preto').projeto.acabamento, 'preto');
});
test('não inventa preços e não promete encaminhamento externo', () => {
  const a = conversa({ movel: 'mesa', uso: 'sala', largura_cm: 120, altura_cm: 80, profundidade_cm: 60, acabamento: 'branco' }, { nome: 'Daniel' })('quanto custa?');
  assert.match(a.resposta, /não calculo valores/);
  assert.doesNotMatch(a.resposta, /R\$|encaminhados|enviados/);
});
