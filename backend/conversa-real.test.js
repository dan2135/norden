const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const pool = require('./database');
const { criarApp } = require('./server');

test('conversa completa: saudação, gaveteiro e escritório com rodinha (IA e PostgreSQL reais)', {
  skip: !(process.env.TEST_DATABASE && process.env.TEST_OLLAMA),
}, async () => {
  const db = await pool.connect();
  let server;
  try {
    await db.query('BEGIN');
    const telefone = '998' + String(Date.now()).slice(-12);
    const banco = {
      query: (...args) => db.query(...args),
      connect: async () => ({
        query: (sql, params) => db.query(({ BEGIN: 'SAVEPOINT api', COMMIT: 'RELEASE SAVEPOINT api', ROLLBACK: 'ROLLBACK TO SAVEPOINT api' })[sql] || sql, params),
        release() {},
      }),
    };
    server = criarApp({ banco }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    let projetoId;
    async function enviar(mensagem) {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api/mensagem`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone, projeto_id: projetoId, mensagem }),
      });
      const dados = await res.json();
      assert.equal(res.status, 200, JSON.stringify(dados));
      projetoId = dados.projeto.id;
      assert.deepEqual(dados.pendencias, [], mensagem);
      assert.doesNotMatch(dados.resposta, /Não confirmei esse dado/);
      console.log(JSON.stringify({ mensagem, resposta: dados.resposta }));
      return dados.projeto;
    }
    assert.equal((await enviar('ola')).movel, null);
    assert.equal((await enviar('quero fazer um gaveteiro')).movel, 'gaveteiro');
    const final = await enviar('no meu ecritorio quero que ele tenha rodinha');
    assert.equal(final.movel, 'gaveteiro');
    assert.equal(final.uso, 'escritório');
    assert.equal(final.detalhes, 'rodinha');
    const mensagens = await db.query('SELECT id FROM mensagens WHERE projeto_id = $1', [projetoId]);
    assert.equal(mensagens.rows.length, 6);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.query('ROLLBACK');
    db.release();
    await pool.end();
  }
});
