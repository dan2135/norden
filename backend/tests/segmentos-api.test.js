/**
 * Testes de regressão: API persiste pedidos gerais, preserva marcenarias e isola empresas. Casos com TEST_DATABASE precisam de banco de testes isolado; não habilitar no banco de produção.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const pool = require('../database');
const { criarApp } = require('../server');
test('API persiste pedidos gerais, preserva marcenarias e isola empresas', {skip:!process.env.TEST_DATABASE}, async()=>{
  const db=await pool.connect(); let server;
  try {
    await db.query('BEGIN');
    const criar=async(segmento)=>(await db.query('INSERT INTO marcenarias(nome,slug,segmento) VALUES ($1,$2,$3) RETURNING id',['Empresa QA',randomUUID(),segmento])).rows[0].id;
    const a=await criar('servicos'), b=await criar('marcenaria');
    const banco={query:(...args)=>db.query(...args),connect:async()=>({query:(sql,p)=>db.query(({BEGIN:'SAVEPOINT setores',COMMIT:'RELEASE SAVEPOINT setores',ROLLBACK:'ROLLBACK TO SAVEPOINT setores'})[sql]||sql,p),release(){}})};
    server=criarApp({banco,logger:{log(){},warn(){}},extrair:async()=>{throw Error('Extração de móveis não deve ser usada');},autenticar:(req,res,next)=>{req.usuario={id:0,superadministrador:true};next();}}).listen(0,'127.0.0.1');
    await once(server,'listening');
    async function chamar(path,body,tenant=a,status=200){
      const res=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Marcenaria-ID':String(tenant)},body:body?JSON.stringify(body):undefined});
      const data=await res.json();assert.equal(res.status,status,JSON.stringify(data));return data;
    }
    const telefone='11999997777';
    let r=await chamar('/mensagem',{telefone,mensagem:'Quero manutenção'});
    const id=r.projeto.id;
    r=await chamar('/mensagem',{telefone,projeto_id:id,mensagem:'No escritório na terça-feira'});
    r=await chamar('/mensagem',{telefone,projeto_id:id,mensagem:'Ana Silva'});
    assert.equal(r.cliente.nome,'Ana Silva');
    assert.equal(r.projeto.movel,null);
    const ficha=(await chamar(`/painel/projetos/${id}`)).projeto;
    assert.equal(ficha.coleta.geral.solicitacao,'Quero manutenção');
    assert.equal(ficha.situacao.categoria,'completo');
    assert.equal((await chamar('/painel')).resumo.completos,1);
    await chamar(`/painel/projetos/${id}`,null,b,404);
    await chamar(`/projetos/${id}/estimativa`,{},a,409);
    r=await chamar('/mensagem',{telefone,mensagem:'quero uma mesa'},b);
    assert.equal(r.projeto.movel,'mesa');
    assert.notEqual(r.cliente.id,ficha.cliente_id);
  } finally {if(server)await new Promise(r=>server.close(r));await db.query('ROLLBACK');db.release();await pool.end();}
});
