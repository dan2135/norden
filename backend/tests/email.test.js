const test=require('node:test');
const assert=require('node:assert/strict');
const {configuracaoEmail,enviarEmail,processarEmail}=require('../email');
const env={EMAIL_MODE:'smtp',SMTP_HOST:'smtp.example.invalid',SMTP_USER:'teste',SMTP_PASS:'teste',EMAIL_FROM:'norden@example.invalid',FRONTEND_URL:'https://example.invalid'};
test('configuração segura e sem simulação silenciosa em produção',()=>{
  assert.equal(configuracaoEmail({}).modo,'simulado');
  assert.throws(()=>configuracaoEmail({NODE_ENV:'production',EMAIL_MODE:'simulado'}));
  assert.throws(()=>configuracaoEmail({EMAIL_MODE:'smtp'}));
  assert.equal(configuracaoEmail(env).transporte.requireTLS,true);
  assert.equal(configuracaoEmail({...env,SMTP_PORT:'465'}).transporte.secure,true);
  assert.throws(()=>configuracaoEmail({...env,SMTP_PORT:'25'}));
  assert.throws(()=>configuracaoEmail({...env,NODE_ENV:'production',FRONTEND_URL:'http://localhost:5176'}));
});
test('enfileira somente; mensagens simuladas nunca viram pendentes',async()=>{
  const chamadas=[],banco={query:async(...args)=>chamadas.push(args)};
  const mensagem={destinatario:'cliente@example.invalid',assunto:'Cadastro',texto:'Link secreto'};
  assert.equal((await enviarEmail(banco,mensagem,{})).simulado,true);
  assert.equal(chamadas[0][1][3],'simulado');
  await enviarEmail(banco,mensagem,env);
  assert.equal(chamadas[1][1][3],'pendente');
});
test('envio aceito remove conteúdo e falha agenda nova tentativa sem expor erro SMTP',async()=>{
  for(const falhar of [false,true]) {
    const chamadas=[];
    const banco={query:async(sql,p)=>{chamadas.push([sql,p]);return {rows:chamadas.length===1?[{id:1,destinatario:'cliente@example.invalid',assunto:'Cadastro',texto:'segredo'}]:[]};}};
    const transporte={sendMail:async msg=>{assert.equal(msg.text,'segredo');if(falhar)throw Error('credenciais não devem aparecer');return {accepted:['cliente@example.invalid']};}};
    assert.equal(await processarEmail(banco,transporte,'norden@example.invalid'),true);
    assert.match(chamadas[1][0],falhar?/tentativas>=5/:/conteúdo removido/);
    assert.deepEqual(chamadas[1][1],[1]);
  }
});
test('fila vazia não envia e-mails',async()=>{
  assert.equal(await processarEmail({query:async()=>({rows:[]})},{sendMail:()=>assert.fail('Não enviar')},'norden@example.invalid'),false);
});
