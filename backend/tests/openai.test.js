/** Respostas simuladas: não usa créditos nem envia dados reais à OpenAI. */
const test=require('node:test'),assert=require('node:assert/strict');
const {consultarOpenAI,responderComOpenAI}=require('../openai');
const env={OPENAI_API_KEY:'chave-ficticia-de-teste',OPENAI_MODEL:'gpt-4.1-mini'};
const ok=texto=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:texto}]}]})});
test('envia chave só no cabeçalho, sem armazenamento e com schema estrito',async()=>{
  const schema={type:'object',properties:{movel:{type:'string'}},required:['movel'],additionalProperties:false};
  const r=await consultarOpenAI({instrucao:'extrair',entrada:{texto:'mesa'},schema},async(url,op)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');
    const body=JSON.parse(op.body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
    assert.equal(op.redirect,'error');assert(op.signal);assert(!op.body.includes(env.OPENAI_API_KEY));
    return ok('{"movel":"mesa"}');
  },env);assert.deepEqual(r,{movel:'mesa'});
});
test('sem chave não chama rede',async()=>{
  await assert.rejects(consultarOpenAI({entrada:{}},()=>{throw Error('não chamar');},{}),/CHAVE_AUSENTE/);
});
test('erros de rede e HTTP não expõem detalhes remotos',async()=>{
  await assert.rejects(consultarOpenAI({},async()=>{throw Error('segredo');},env),/OPENAI_CONEXAO_INDISPONIVEL/);
  for(const status of [401,429,500])await assert.rejects(consultarOpenAI({},async()=>({ok:false,status}),env),new RegExp('OPENAI_HTTP_'+status));
});
test('recusa, saída incompleta, vazia ou JSON inválido não são aceitos',async()=>{
  for(const data of [{status:'incomplete'},{status:'completed',output:[]},{status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]}]){
    await assert.rejects(consultarOpenAI({},async()=>({ok:true,json:async()=>data}),env),/OPENAI_/);
  }
  await assert.rejects(consultarOpenAI({schema:{}},async()=>ok('não é JSON'),env),/JSON_INVALIDO/);
});
test('resposta usa somente contexto permitido e histórico limitado',async()=>{
  const empresa={nome:'Empresa Teste',segmento:'servicos',senha:'nao-enviar'};
  const historico=Array.from({length:20},(_,i)=>({role:'user',content:'x'.repeat(3000),id:i,cpf:'nao-enviar'}));
  const r=await responderComOpenAI({empresa,historico,respostaBase:'Qual serviço você precisa?'},async(url,op)=>{
    const body=JSON.parse(op.body),entrada=JSON.parse(body.input);
    assert.equal(entrada.historico.length,8);assert.equal(entrada.historico[0].content.length,2000);
    assert(!op.body.includes('nao-enviar'));assert(body.instructions.includes('entender a necessidade do cliente'));
    assert(!body.instructions.includes('Não calcule'));
    return ok('Qual serviço você precisa?');
  },env);assert.equal(r,'Qual serviço você precisa?');
});
test('resposta da OpenAI com valor pode ser usada enquanto planos não limitam conversa', async () => {
  const respostaBase='Perfeito, registrei as informações para a equipe continuar seu atendimento.';
  const r=await responderComOpenAI({empresa:{nome:'Empresa Teste',segmento:'servicos'},historico:[],respostaBase},async()=>ok('Esse projeto fica R$ 500,00.'),env);
  assert.equal(r,'Esse projeto fica R$ 500,00.');
});
test('resposta da OpenAI com apresentação ou nome interno da empresa é descartada quando a base não pede', async () => {
  const respostaBase='Você sabe a largura aproximada? Pode mandar com a unidade, tipo 80 cm.';
  const empresa={nome:'Empresa principal',segmento:'marcenaria'};
  const r1=await responderComOpenAI({empresa,historico:[{role:'assistant',content:'Oi! Sou a Suzy, atendente virtual.'}],respostaBase},async()=>ok('Sou a Suzy, assistente virtual da Empresa principal. Qual a largura?'),env);
  assert.equal(r1,respostaBase);
});
