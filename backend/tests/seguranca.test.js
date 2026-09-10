/**
 * Testes de regressão: validação de e-mail rejeita entradas longas antes da análise; entradas adversariais terminam sem bloquear o processo; API bloqueia CSRF em rotas públicas e mantém token por sessão.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { spawnSync } = require('node:child_process');
const { emailValido } = require('../seguranca');
const { criarApp } = require('../server');

test('validação de e-mail rejeita entradas longas antes da análise', () => {
  assert.equal(emailValido('teste@example.com'), true);
  for(const valor of ['a@b', 'a@@b.com', 'a @b.com', 'a@.com', 'a@b.', 'a@'+'.'.repeat(100000)+'!']) assert.equal(emailValido(valor), false);
});

test('entradas adversariais terminam sem bloquear o processo', () => {
  const script = `
    const assert=require('node:assert/strict');
    const {analisarMensagem}=require('./coleta');
    const {medidaExplicita}=require('./dados-projeto');
    const {complementoExplicito}=require('./extracao');
    for(const texto of ['9'.repeat(10000)+'!', 'no '+ ' '.repeat(9000)+'!', 'a'.repeat(10001)]) {
      for(const fn of [analisarMensagem, t=>medidaExplicita(t,'largura_cm'), complementoExplicito]) assert.throws(()=>fn(texto));
    }
    for (const texto of ['largura '.repeat(1200), 'no quarto quero que ele tenha '.repeat(200)+'!']) {
      analisarMensagem(texto); complementoExplicito(texto);
    }
  `;
  const r=spawnSync(process.execPath,['-e',script],{cwd:require('node:path').join(__dirname,'..'),timeout:5000,encoding:'utf8'});
  assert.equal(r.error,undefined); assert.equal(r.status,0,r.stderr);
});

test('API bloqueia CSRF em rotas públicas e mantém token por sessão',async()=>{
  let consultas=0;
  const banco={query:async(sql)=>{consultas++; if(sql.includes('FROM sessoes')) return {rows:[{token_hash:'hash',csrf_token:'token-correto',usuario_id:1,nome:'Teste'}]};return {rows:[]};}};
  const server=criarApp({banco}).listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}/api`;
  try {
    for(const rota of ['/auth/login','/auth/cadastro','/auth/esqueci-senha','/auth/redefinir-senha','/auth/configurar']) {
      const r=await fetch(base+rota,{method:'POST',headers:{origin:'https://hostil.invalid','content-type':'application/json'},body:'{}'});
      assert.equal(r.status,403);
    }
    assert.equal(consultas,0);
    assert.equal((await fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'text/plain'},body:'{}'})).status,415);
    assert.equal((await fetch(base+'/auth/login',{method:'POST',headers:{origin:'http://localhost:5176','content-type':'application/json'},body:'{}'})).status,401);
    for(const token of ['', 'incorreto']) assert.equal((await fetch(base+'/auth/logout',{method:'POST',headers:{cookie:'marceneiro_session=teste','x-csrf-token':token}})).status,403);
    assert.equal((await fetch(base+'/auth/logout',{method:'POST',headers:{cookie:'marceneiro_session=teste','x-csrf-token':'token-correto'}})).status,200);
  } finally {await new Promise(r=>server.close(r));}
});
