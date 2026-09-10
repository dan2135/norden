/** Integração simulada: nenhuma credencial real, acesso ao banco ou envio externo. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { criarTransporteBrevo } = require('../email-brevo');
const { configuracaoEmail, enviarEmail, processarEmail } = require('../email');
const { configuracaoBancoDemo } = require('../banco-demo');
const env = { NODE_ENV:'production', EMAIL_MODE:'brevo', BREVO_API_KEY:'chave-ficticia', EMAIL_FROM:'norden@example.com', FRONTEND_URL:'https://demo.example.com' };
const mensagem = { from:{name:'Norden',address:env.EMAIL_FROM}, to:'amigo@example.com', subject:'Cadastro', text:'Link de teste' };

test('Brevo exige chave e URL segura; cadastro enfileira para envio real', async () => {
  assert.equal(configuracaoEmail(env).modo,'brevo');
  assert.throws(() => configuracaoEmail({...env,BREVO_API_KEY:''}));
  assert.throws(() => configuracaoEmail({...env,FRONTEND_URL:'http://localhost'}));
  let parametros;
  const resultado=await enviarEmail({query:async(sql,p)=>{parametros=p;}},{destinatario:mensagem.to,assunto:mensagem.subject,texto:mensagem.text},env);
  assert.equal(parametros[3],'pendente');
  assert.deepEqual(resultado,{simulado:false,enfileirado:true});
});

test('transporte HTTPS mantém chave no cabeçalho e valida aceitação do provedor',async()=>{
  const transporte=criarTransporteBrevo(env.BREVO_API_KEY,async(url,op)=>{
    assert.equal(url,'https://api.brevo.com/v3/smtp/email');
    assert.equal(op.headers['api-key'],env.BREVO_API_KEY);
    assert.equal(op.redirect,'error'); assert(op.signal);
    const body=JSON.parse(op.body);
    assert.equal(body.textContent,mensagem.text);assert.deepEqual(body.to,[{email:mensagem.to}]);
    assert(!op.body.includes(env.BREVO_API_KEY));
    return {status:201,json:async()=>({messageId:'id-ficticio'})};
  });
  assert.deepEqual((await transporte.sendMail(mensagem)).accepted,[mensagem.to]);
  for(const status of [400,401,429,500]) {
    const falha=criarTransporteBrevo('teste',async()=>({status,json:()=>assert.fail('Não ler erro privado')}));
    await assert.rejects(falha.sendMail(mensagem),new RegExp(`HTTP ${status}`));
  }
  await assert.rejects(criarTransporteBrevo('teste',async()=>{throw Error('segredo');}).sendMail(mensagem),/^Error: Serviço de e-mail indisponível\.$/);
  await assert.rejects(criarTransporteBrevo('teste',async()=>({status:201,json:async()=>({})})).sendMail(mensagem),/não confirmou/);
});

test('falha HTTPS permanece na fila e aceitação remove conteúdo',async()=>{
  for(const status of [201,429]) {
    const sqls=[];
    const banco={query:async(sql)=>{sqls.push(sql);return {rows:sqls.length===1?[{id:3,destinatario:mensagem.to,assunto:mensagem.subject,texto:mensagem.text}]:[]};}};
    const transporte=criarTransporteBrevo('teste',async()=>({status,json:async()=>({messageId:'id-ficticio'})}));
    await processarEmail(banco,transporte,env.EMAIL_FROM);
    assert.match(sqls[1],status===201?/conteúdo removido após envio/:/proxima_tentativa_em/);
  }
});

test('demo não herda credenciais principais e exige banco próprio',()=>{
  assert.throws(()=>configuracaoBancoDemo({DB_HOST:'principal'}),/DEMO_DB_HOST/);
  const dados={DEMO_DB_HOST:'demo.example.com',DEMO_DB_PORT:'5432',DEMO_DB_DATABASE:'postgres',DEMO_DB_USER:'demo',DEMO_DB_PASSWORD:'ficticia'};
  assert.equal(configuracaoBancoDemo(dados).DB_SSL,'true');
  assert.throws(()=>configuracaoBancoDemo({...dados,DB_HOST:dados.DEMO_DB_HOST,DB_DATABASE:'postgres',DB_USER:'demo'}),/separado/);
});
