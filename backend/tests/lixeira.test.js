/**
 * Testes de regressão: lixeira isola empresas, bloqueia atendimento e restaura todos os vínculos. Casos com TEST_DATABASE precisam de banco de testes isolado; não habilitar no banco de produção.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const crypto = require('node:crypto');
const pool = require('../database');
const { criarHashSenha } = require('../auth');
const { criarApp } = require('../server');

test('lixeira isola empresas, bloqueia atendimento e restaura todos os vínculos', { skip: !process.env.TEST_DATABASE }, async () => {
  const db = await pool.connect(); let server;
  try {
    await db.query('BEGIN');
    const empresa = async () => (await db.query('INSERT INTO marcenarias(nome,slug) VALUES ($1,$2) RETURNING id', ['Teste lixeira',`lixeira-${crypto.randomUUID()}`])).rows[0].id;
    const a = await empresa(), b = await empresa();
    const senhaTeste='senha-exclusao-teste';
    const usuario=(await db.query('INSERT INTO usuarios(nome,email,senha_hash) VALUES ($1,$2,$3) RETURNING id',['Teste exclusão',`${crypto.randomUUID()}@example.invalid`,await criarHashSenha(senhaTeste)])).rows[0].id;
    const cliente = (await db.query("INSERT INTO clientes(nome,telefone,marcenaria_id) VALUES ('Cliente teste','11999998888',$1) RETURNING id", [a])).rows[0].id;
    const projeto = (await db.query("INSERT INTO projetos(cliente_id,marcenaria_id,movel) VALUES ($1,$2,'mesa') RETURNING id", [cliente,a])).rows[0].id;
    await db.query("INSERT INTO mensagens(cliente_id,projeto_id,marcenaria_id,remetente,texto) VALUES ($1,$2,$3,'cliente','Quero uma mesa')", [cliente,projeto,a]);
    const orcamento = (await db.query('INSERT INTO orcamentos(projeto_id,marcenaria_id) VALUES ($1,$2) RETURNING id', [projeto,a])).rows[0].id;
    const banco = { query: (...args) => db.query(...args), connect: async () => ({
      query: (sql,params) => db.query(({BEGIN:'SAVEPOINT lixeira', COMMIT:'RELEASE SAVEPOINT lixeira', ROLLBACK:'ROLLBACK TO SAVEPOINT lixeira'})[sql] || sql,params), release() {},
    }) };
    // Autenticação injetada apenas no teste; o isolamento por empresa é o middleware real.
    server = criarApp({ banco, autenticar: (req,res,next) => { req.usuario={id:usuario,superadministrador:true}; next(); } }).listen(0,'127.0.0.1');
    await once(server,'listening');
    const base = `http://127.0.0.1:${server.address().port}/api`;
    async function chamar(path, method='GET', status=200, tenant=a, body) {
      const res = await fetch(base+path,{method,headers:{'X-Marcenaria-ID':String(tenant),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
      const data = await res.json(); assert.equal(res.status,status,JSON.stringify(data)); return data;
    }
    assert.equal((await chamar('/painel')).resumo.clientes,1);
    await chamar(`/clientes/${cliente}`,'DELETE',404,b);
    await chamar(`/clientes/${cliente}`,'DELETE');
    await chamar(`/clientes/${cliente}`,'DELETE'); // Idempotente.
    assert.equal((await chamar('/painel')).resumo.projetos,0);
    assert.equal((await chamar('/clientes/lixeira')).clientes.length,1);
    assert.equal((await chamar('/clientes/lixeira','GET',200,b)).clientes.length,0);
    assert.equal((await chamar('/projetos?telefone=11999998888')).projetos.length,0);
    await chamar(`/painel/projetos/${projeto}`,'GET',409);
    await chamar(`/projetos/${projeto}/orcamento`,'GET',409);
    await chamar(`/orcamentos/${orcamento}`,'PUT',409,a,{});
    await chamar('/mensagem','POST',409,a,{telefone:'11999998888',projeto_id:projeto,mensagem:'oi'});
    await chamar(`/clientes/${cliente}/restaurar`,'POST',404,b);
    await chamar(`/clientes/${cliente}/restaurar`,'POST');
    const painel = await chamar('/painel'); assert.equal(painel.resumo.clientes,1); assert.equal(painel.resumo.projetos,1);
    assert.equal((await chamar('/clientes/lixeira')).clientes.length,0);
    assert.equal((await chamar(`/painel/projetos/${projeto}`)).mensagens.length,1);
    await chamar(`/projetos/${projeto}/orcamento`);
    assert.equal((await db.query('SELECT count(*)::int AS total FROM orcamentos WHERE id=$1',[orcamento])).rows[0].total,1);
    const frase={senha:senhaTeste};
    await chamar(`/projetos/${projeto}/permanente`,'DELETE',409,a,frase);
    await chamar(`/projetos/${projeto}`,'DELETE',404,b);
    await chamar(`/projetos/${projeto}`,'DELETE');
    assert.equal((await chamar('/projetos/lixeira')).projetos.length,1);
    assert.equal((await chamar('/projetos/lixeira','GET',200,b)).projetos.length,0);
    assert.equal((await chamar('/painel')).resumo.projetos,0);
    await chamar(`/projetos/${projeto}/orcamento`,'GET',409);
    await chamar('/mensagem','POST',404,a,{telefone:'11999998888',projeto_id:projeto,mensagem:'oi'});
    await chamar(`/clientes/${cliente}`,'DELETE');
    await chamar(`/projetos/${projeto}/restaurar`,'POST',409);
    await chamar(`/clientes/${cliente}/restaurar`,'POST');
    assert.equal((await chamar('/painel')).resumo.projetos,0);
    await chamar(`/projetos/${projeto}/restaurar`,'POST');
    assert.equal((await chamar('/painel')).resumo.projetos,1);
    const outro=(await db.query("INSERT INTO projetos(cliente_id,marcenaria_id,movel) VALUES ($1,$2,'armário') RETURNING id",[cliente,a])).rows[0].id;
    await chamar(`/projetos/${projeto}`,'DELETE');
    await chamar(`/projetos/${projeto}/permanente`,'DELETE',400,a,{});
    await chamar(`/projetos/${projeto}/permanente`,'DELETE',403,a,{senha:'incorreta'});
    assert.equal((await chamar('/projetos/lixeira')).projetos.length,1);
    await chamar(`/projetos/${projeto}/permanente`,'DELETE',404,b,frase);
    await chamar(`/projetos/${projeto}/permanente`,'DELETE',200,a,frase);
    assert.equal((await db.query('SELECT count(*)::int AS total FROM orcamentos WHERE id=$1',[orcamento])).rows[0].total,0);
    assert.equal((await db.query('SELECT count(*)::int AS total FROM mensagens WHERE projeto_id=$1',[projeto])).rows[0].total,0);
    assert.equal((await chamar('/painel')).resumo.clientes,1);
    assert.equal(String((await chamar('/painel')).projetos[0].id),String(outro));
    const fraseCliente={senha:senhaTeste};
    await chamar(`/clientes/${cliente}/permanente`,'DELETE',409,a,fraseCliente);
    await chamar(`/clientes/${cliente}`,'DELETE');
    await chamar(`/clientes/${cliente}/permanente`,'DELETE',404,b,fraseCliente);
    await chamar(`/clientes/${cliente}/permanente`,'DELETE',403,a,{senha:'incorreta'});
    assert.equal((await chamar('/clientes/lixeira')).clientes.length,1);
    await chamar(`/clientes/${cliente}/permanente`,'DELETE',200,a,fraseCliente);
    assert.equal((await chamar('/clientes/lixeira')).clientes.length,0);
    assert.equal((await db.query('SELECT count(*)::int AS total FROM projetos WHERE id=$1',[outro])).rows[0].total,0);
    await chamar(`/clientes/${cliente}/restaurar`,'POST',404);
  } finally {
    if(server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await db.query('ROLLBACK'); db.release(); await pool.end();
  }
});
