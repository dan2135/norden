import { test } from 'node:test';
import assert from 'node:assert/strict';
// O cliente HTTP usa a origem do navegador; simula apenas essa origem no Node.
globalThis.window = { location: { protocol: 'http:', hostname: 'localhost' } };
const { requisicao } = await import('../src/api.js');

test('retorna JSON em sucesso', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ projetos: [] }), { headers: { 'content-type': 'application/json' } }));
  assert.deepEqual(await requisicao('/projetos'), { projetos: [] });
});
test('erro HTML orienta reiniciar em vez de mostrar Unexpected token', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<!DOCTYPE html>', { status: 404, headers: { 'content-type': 'text/html' } }));
  await assert.rejects(requisicao('/projetos'), /Reinicie o backend/);
});
test('erro HTTP em JSON exibe mensagem legível', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ mensagem: 'Selecione o projeto' }), { status: 409, headers: { 'content-type': 'application/json' } }));
  await assert.rejects(requisicao('/mensagem'), /Selecione o projeto/);
});
test('backend desligado e JSON malformado têm tratamento', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(requisicao('/status'), /conectar ao backend/);
  mock.mock.mockImplementation(async () => new Response('inválido', { headers: { 'content-type': 'application/json' } }));
  await assert.rejects(requisicao('/status'), /dados inválidos/);
});
