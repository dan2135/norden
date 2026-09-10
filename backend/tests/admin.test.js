/** Testes isolados: nenhuma conta real é criada. */
const test=require('node:test'), assert=require('node:assert/strict');
const {once}=require('node:events');
const {provisionarAdmin}=require('../admin');
const {criarHashSenha,conferirSenha}=require('../auth');
const {criarApp}=require('../server');
const env={ADMIN_USUARIO:'gestor',ADMIN_EMAIL:'gestor@example.com',ADMIN_SENHA:'temporaria-segura-123'};
test('provisionamento valida credenciais antes de conectar',async()=>{
  const banco={connect:()=>{throw Error('não deve conectar');}};
  await assert.rejects(provisionarAdmin(banco,{...env,ADMIN_SENHA:'curta'}),/ADMIN_SENHA/);
  await assert.rejects(provisionarAdmin(banco,{...env,ADMIN_EMAIL:'gestor@local.invalid'}),/ADMIN_EMAIL/);
});
test('provisionamento confirma email, exige troca e invalida acessos antigos',async()=>{
  const sqls=[];let hash;
  const db={query:async(sql,args)=>{sqls.push(sql);if(sql.startsWith('INSERT')){hash=args[2];return {rows:[{id:1}]};}return {rows:[]};},release(){}};
  await provisionarAdmin({connect:async()=>db},env);
  assert.equal(await conferirSenha(env.ADMIN_SENHA,hash),true);
  assert(sqls.some(s=>s.includes('TRUE,TRUE,TRUE')));
  assert(sqls.some(s=>s.startsWith('DELETE FROM sessoes')));
  assert.equal(sqls.at(-1),'COMMIT');
});
test('não promove conta comum nem substitui administrador sem autorização',async()=>{
  for(const superadministrador of [false,true]){
    const sqls=[];const db={query:async sql=>{sqls.push(sql);return {rows:sql.startsWith('SELECT')?[{id:1,superadministrador}]:[]};},release(){}};
    await assert.rejects(provisionarAdmin({connect:async()=>db},env),superadministrador?/ADMIN_REDEFINIR/:/promoção/);
    assert.equal(sqls.at(-1),'ROLLBACK');
    assert(!sqls.some(s=>s.startsWith('UPDATE usuarios')));
  }
});
test('sessão temporária bloqueia dados; troca exige senha e CSRF e revoga sessões',async()=>{
  let hash=await criarHashSenha(env.ADMIN_SENHA), ativa=true, temporaria=true;
  const consultas=[];
  const db={query:async(sql,args)=>{
    consultas.push(sql);
    if(sql.includes('FROM sessoes s'))return {rows:ativa?[{usuario_id:1,csrf_token:'csrf',trocar_senha:temporaria,superadministrador:true}]:[]};
    if(sql.startsWith('SELECT senha_hash'))return {rows:[{senha_hash:hash}]};
    if(sql.startsWith('UPDATE usuarios SET senha_hash')){hash=args[0];temporaria=false;}
    if(sql.startsWith('DELETE FROM sessoes'))ativa=false;
    return {rows:[]};
  },release(){}};
  const banco={query:db.query,connect:async()=>db};
  const server=criarApp({banco}).listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}/api`;
  const req=(path,body,csrf='csrf')=>fetch(base+path,{method:body?'POST':'GET',headers:{cookie:'marceneiro_session=teste','content-type':'application/json','x-csrf-token':csrf},...(body?{body:JSON.stringify(body)}:{})});
  try{
    assert.equal((await req('/painel')).status,403);
    const sessao=await (await req('/auth/sessao')).json();assert.deepEqual(sessao.marcenarias,[]);
    const corpo={senha_atual:env.ADMIN_SENHA,nova_senha:'definitiva-segura-456'};
    assert.equal((await req('/auth/trocar-senha',corpo,'errado')).status,403);
    assert.equal((await req('/auth/trocar-senha',{...corpo,senha_atual:'errada'})).status,403);
    assert.equal((await req('/auth/trocar-senha',{...corpo,nova_senha:env.ADMIN_SENHA})).status,400);
    assert.equal((await req('/auth/trocar-senha',corpo)).status,200);
    assert.equal(await conferirSenha(corpo.nova_senha,hash),true);
    assert.equal(temporaria,false);assert.equal(ativa,false);
    assert(consultas.some(s=>s.startsWith('UPDATE tokens_usuario')));
    assert.equal((await req('/auth/sessao')).status,401);
  }finally{await new Promise(r=>server.close(r));}
});
