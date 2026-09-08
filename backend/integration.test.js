const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const pool = require('./database');
const { criarApp } = require('./server');

test('API: atendimento, pendências persistidas, logs, isolamento, falhas e rollback', { skip: !process.env.TEST_DATABASE }, async () => {
  const db = await pool.connect();
  let server;
  try {
    await db.query('BEGIN');
    const telefone = '999' + String(Date.now()).slice(-12);
    let falharBanco = false;
    const banco = {
      query: (...args) => db.query(...args),
      connect: async () => ({
        query: (sql, params) => {
          if (falharBanco && sql.includes('UPDATE projetos')) throw new Error('Falha de banco simulada');
          return db.query(({ BEGIN: 'SAVEPOINT api', COMMIT: 'RELEASE SAVEPOINT api', ROLLBACK: 'ROLLBACK TO SAVEPOINT api' })[sql] || sql, params);
        },
        release() {},
      }),
    };
    const logs = [];
    const avisos = [];
    const historicos = [];
    const app = criarApp({ banco, logger: { log: (...args) => logs.push(args), warn: (...args) => avisos.push(args) },
      extrair: async historico => {
        historicos.push(historico);
        if (historico.at(-1).content === 'IA fora do ar') throw new Error('Ollama indisponível');
        if (historico.at(-1).content === 'Saída malformada') return null;
        return { movel: { valor: 'gaveteiro', trecho: 'texto inventado' }, acabamento: { valor: 'carvalho', trecho: 'texto inventado' } };
      },
    });
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/api`;
    async function chamar(path, body, status = 200) {
      const res = await fetch(url + path, body ? {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      } : undefined);
      assert.match(res.headers.get('content-type'), /application\/json/);
      const data = await res.json();
      assert.equal(res.status, status, JSON.stringify(data));
      return data;
    }
    const mesa = await chamar('/mensagem', { telefone, mensagem: 'me chamo Daniel e quero uma mesa com largura de 120 cm' });
    assert.equal(mesa.cliente.nome, 'Daniel');
    assert.equal(Number(mesa.projeto.largura_cm), 120);
    const outro = (await chamar('/projetos', { telefone }, 201)).projeto;
    const msg = mensagem => chamar('/mensagem', { telefone, projeto_id: outro.id, mensagem });
    await msg('quero um gaveteiro');
    const pendente = await msg('quero que ele tenha 80 de altura uns 30 profundidade e uns 30 de larguda');
    assert.equal(pendente.projeto.altura_cm, null);
    assert.equal(pendente.projeto.coleta.medidas.altura_cm, '80');
    assert.match(pendente.resposta, /centímetros/);
    const recarregado = await chamar(`/projetos/${outro.id}/mensagens?telefone=${telefone}`);
    assert.equal(recarregado.projeto.coleta.medidas.altura_cm, '80');
    const confirmado = await msg('sim');
    assert.equal(Number(confirmado.projeto.altura_cm), 80);
    assert.equal(Number(confirmado.projeto.largura_cm), 30);
    assert.equal(Number(confirmado.projeto.profundidade_cm), 30);
    const ambiente = await msg('no meu quarto');
    assert.equal(ambiente.projeto.movel, 'gaveteiro');
    assert.equal(ambiente.projeto.uso, 'quarto');
    assert.doesNotMatch(ambiente.resposta, /móvel desejado/);
    await msg('com rodinhas');
    const completo = await msg('branco');
    assert.match(completo.resposta, /dados principais estão registrados/);
    const corrigido = await msg('altura de 90 cm');
    assert.equal(Number(corrigido.projeto.altura_cm), 90);
    assert.equal(Number(corrigido.projeto.largura_cm), 30);
    const malformada = await msg('Saída malformada');
    assert.deepEqual(malformada.pendencias, []);
    assert.equal(malformada.projeto.movel, 'gaveteiro');
    const indisponivel = await msg('IA fora do ar');
    assert.equal(indisponivel.projeto.movel, 'gaveteiro');
    assert.equal(avisos.length, 1);
    assert.ok(historicos.at(-1).every(m => !m.content.includes('mesa')));
    const antesFalha = await chamar(`/projetos/${outro.id}/mensagens?telefone=${telefone}`);
    falharBanco = true;
    await chamar('/mensagem', { telefone, projeto_id: outro.id, mensagem: 'altura de 100 cm' }, 500);
    falharBanco = false;
    const depoisFalha = await chamar(`/projetos/${outro.id}/mensagens?telefone=${telefone}`);
    assert.equal(depoisFalha.mensagens.length, antesFalha.mensagens.length);
    assert.equal(Number(depoisFalha.projeto.altura_cm), 90);
    const mesaIntacta = await chamar(`/projetos/${mesa.projeto.id}/mensagens?telefone=${telefone}`);
    assert.equal(mesaIntacta.mensagens.length, 2);
    assert.equal(Number(mesaIntacta.projeto.largura_cm), 120);
    await chamar('/mensagem', { telefone, mensagem: 'Ambígua' }, 409);
    await chamar('/mensagem', { telefone: '11800000000', projeto_id: outro.id, mensagem: 'Outro cliente' }, 404);
    await chamar(`/projetos/${outro.id}/mensagens?telefone=11800000000`, null, 404);
    await chamar('/mensagem', { telefone, projeto_id: outro.id, mensagem: ' ' }, 400);
    await chamar('/mensagem', { telefone, projeto_id: outro.id, mensagem: 'a'.repeat(10001) }, 400);
    await chamar('/inexistente', null, 404);
    const invalido = await fetch(url + '/mensagem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{inválido' });
    assert.equal(invalido.status, 400);
    assert.match((await invalido.json()).mensagem, /JSON inválido/);
    assert.ok(logs.length >= 10);
    const ultimoLog = JSON.parse(logs.at(-1)[1]);
    assert.equal(ultimoLog.nome, 'Daniel');
    assert.equal(ultimoLog.projeto_id, outro.id);
    assert.ok('descartados_ia' in ultimoLog);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.query('ROLLBACK');
    db.release();
    await pool.end();
  }
});
