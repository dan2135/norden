/**
 * Testes de regressão: gera identificador legível e seguro para a marcenaria; API isola telefone, projeto e histórico entre duas marcenarias. Casos com TEST_DATABASE precisam de banco de testes isolado; não habilitar no banco de produção.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { slugify } = require('./marcenarias');
const { criarApp } = require('./server');
const pool = require('./database');

test('gera identificador legível e seguro para a marcenaria', () => {
  assert.equal(slugify('Móveis São José & Filhos'), 'moveis-sao-jose-filhos');
  assert.equal(slugify('  Oficina 2  '), 'oficina-2');
});

test('API isola telefone, projeto e histórico entre duas marcenarias', { skip: !process.env.TEST_DATABASE }, async () => {
  const db = await pool.connect(); let server;
  try {
    await db.query('BEGIN');
    const sufixo = Date.now();
    const a = (await db.query('INSERT INTO marcenarias(nome,slug) VALUES ($1,$2) RETURNING id', ['QA A',`qa-a-${sufixo}`])).rows[0];
    const b = (await db.query('INSERT INTO marcenarias(nome,slug) VALUES ($1,$2) RETURNING id', ['QA B',`qa-b-${sufixo}`])).rows[0];
    const banco = { query:(...args)=>db.query(...args), connect:async()=>({ query:(sql,p)=>db.query(({BEGIN:'SAVEPOINT mt',COMMIT:'RELEASE SAVEPOINT mt',ROLLBACK:'ROLLBACK TO SAVEPOINT mt'})[sql]||sql,p),release(){} }) };
    server = criarApp({ banco, extrair:async()=>({}) }).listen(0,'127.0.0.1'); await once(server,'listening');
    const base = `http://127.0.0.1:${server.address().port}/api`, telefone='11999998888';
    async function chamar(id,path,body,status=200) {
      const res = await fetch(base+path,{ method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Marcenaria-ID':String(id)},body:body?JSON.stringify(body):undefined });
      const data=await res.json(); assert.equal(res.status,status,JSON.stringify(data)); return data;
    }
    const ra=await chamar(a.id,'/mensagem',{telefone,mensagem:'quero uma mesa'});
    const rb=await chamar(b.id,'/mensagem',{telefone,mensagem:'quero um armário'});
    assert.notEqual(ra.cliente.id,rb.cliente.id); assert.notEqual(ra.projeto.id,rb.projeto.id);
    const pa=await chamar(a.id,'/painel'); const pb=await chamar(b.id,'/painel');
    assert.deepEqual(pa.projetos.map(p=>p.movel),['mesa']); assert.deepEqual(pb.projetos.map(p=>p.movel),['armário']);
    await chamar(a.id,`/painel/projetos/${rb.projeto.id}`,null,404);
  } finally { if(server) await new Promise(r=>server.close(r)); await db.query('ROLLBACK'); db.release(); await pool.end(); }
});
