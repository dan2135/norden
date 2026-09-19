/**
 * Testes de regressão: valida ramo e rejeita valores desconhecidos; o ramo técnico mantém campos específicos e dados gerais incompletos continuam em coleta.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarSegmento, analisarSolicitacao, responderSolicitacao } = require('../segmentos');
const { situacaoColeta } = require('../painel');

test('valida ramo e rejeita valores desconhecidos', () => {
  assert.equal(validarSegmento(), 'outros');
  for (const ramo of ['marcenaria','serralheria','comercio','servicos','outros']) assert.equal(validarSegmento(ramo), ramo);
  for (const ramo of ['invalido',null,'toString']) assert.throws(()=>validarSegmento(ramo));
});
for(const segmento of ['marcenaria','serralheria','comercio','servicos','outros']) test(`coleta ${segmento} sem exigir dados de móveis`,()=>{
  const empresa={nome:'Empresa teste',segmento}, cliente={}, projeto={coleta:{}};
  function enviar(texto,primeiro=false){
    const a=analisarSolicitacao(texto,projeto,cliente);
    const resposta=responderSolicitacao(a,cliente,empresa,primeiro);
    projeto.coleta=JSON.parse(JSON.stringify(a.estado));
    if(a.nome)cliente.nome=a.nome;
    assert.ok(Object.values(a.dados).every(v=>v===null));
    assert.doesNotMatch(resposta,/largura|altura|profundidade|acabamento|móvel/i);
    return resposta;
  }
  assert.match(enviar('oi',true),/Suzy, atendente virtual/);
  assert.doesNotMatch(enviar('quem é você?'),/Empresa teste/);
  assert.equal(projeto.coleta.geral.solicitacao,undefined);
  enviar('Preciso de manutenção');
  enviar('Visita na segunda-feira');
  enviar('Ana Silva');
  const preco=enviar('quanto custa?');
  assert.match(preco,/não calculo valores/);
  assert.doesNotMatch(preco,/R\$/);
  assert.equal(cliente.nome,'Ana Silva');
  assert.equal(projeto.coleta.geral.solicitacao,'Preciso de manutenção');
  assert.equal(projeto.coleta.geral.detalhes,'Visita na segunda-feira');
  assert.equal(situacaoColeta({...projeto,segmento,cliente_nome:cliente.nome}).categoria,'completo');
  enviar('oi');
  assert.equal(projeto.coleta.geral.solicitacao,'Preciso de manutenção');
});
test('ramo de clínica direciona para agendamento sem pedir medidas', () => {
  const empresa={nome:'Clínica teste',segmento:'outros',atividade:'Clínica odontológica'}, cliente={}, projeto={coleta:{}};
  const enviar = texto => {
    const a=analisarSolicitacao(texto,projeto,cliente);
    const resposta=responderSolicitacao(a,cliente,empresa,!projeto.coleta?.geral?.solicitacao);
    projeto.coleta=JSON.parse(JSON.stringify(a.estado));
    if(a.nome)cliente.nome=a.nome;
    return resposta;
  };
  assert.match(enviar('oi'),/Como posso ajudar/);
  const detalhes = enviar('quero agendar uma consulta');
  assert.match(detalhes,/atendimento|dia|horário/i);
  assert.doesNotMatch(detalhes,/largura|altura|profundidade|acabamento|móvel/i);
});
test('marcenaria mantém campos técnicos e dados gerais incompletos continuam em coleta',()=>{
  assert.equal(situacaoColeta({segmento:'marcenaria'}).total_campos,7);
  assert.deepEqual(situacaoColeta({segmento:'marcenaria',coleta:{geral:{solicitacao:'bancada'}},cliente_nome:''}), {
    categoria:'em_coleta', faltantes:['Detalhes','Nome do cliente'], pendencias:[], preenchidos:1, total_campos:3
  });
  assert.equal(situacaoColeta({segmento:'servicos'}).total_campos,3);
  assert.equal(situacaoColeta({segmento:'servicos'}).categoria,'em_coleta');
});
