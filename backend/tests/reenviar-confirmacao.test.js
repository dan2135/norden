/**
 * Testes de regressão: reenvio valida e-mail antes de abrir conexão; não revela existência da conta e respeita intervalo de reenvio; falha na fila reverte token e libera conexão.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const {reenviarConfirmacao}=require('../reenviar-confirmacao');

test('reenvio valida e-mail antes de abrir conexão',async()=>{
  await assert.rejects(reenviarConfirmacao({connect:()=>assert.fail('Não conectar')},'inválido'),/e-mail válido/);
});
test('não revela existência da conta e respeita intervalo de reenvio',async()=>{
  const respostas=[];
  for(const caso of ['ausente','confirmado','recente','enviar']) {
    const sqls=[];let envios=0,liberou=false;
    const db={release(){liberou=true;},async query(sql,params){sqls.push(sql);
      if(sql.startsWith('SELECT id'))return {rows:caso==='ausente'?[]:[{id:1,nome:'Teste',email:'teste@example.invalid',email_confirmado:caso==='confirmado'}]};
      if(sql.startsWith('SELECT 1'))return {rows:caso==='recente'?[{}]:[]};
      if(sql.startsWith('INSERT'))assert.match(params[0],/^[a-f0-9]{64}$/);
      return {rows:[]};
    }};
    respostas.push(await reenviarConfirmacao({connect:async()=>db},'teste@example.invalid',async(_,mensagem)=>{envios++;assert.match(mensagem.texto,/confirmar=/);}));
    assert.equal(envios,caso==='enviar'?1:0);assert.equal(sqls.at(-1),'COMMIT');assert.equal(liberou,true);
  }
  assert.ok(respostas.every(r=>r.mensagem===respostas[0].mensagem));
});
test('falha na fila reverte token e libera conexão',async()=>{
  const sqls=[];let liberou=false;
  const db={release(){liberou=true;},query:async sql=>{sqls.push(sql);return {rows:sql.startsWith('SELECT id')?[{id:1,nome:'Teste',email:'teste@example.invalid',email_confirmado:false}]:[]};}};
  await assert.rejects(reenviarConfirmacao({connect:async()=>db},'teste@example.invalid',async()=>{throw Error('fila indisponível');}),/fila indisponível/);
  assert.equal(sqls.at(-1),'ROLLBACK');assert.equal(liberou,true);
});
