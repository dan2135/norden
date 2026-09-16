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
for(const segmento of ['serralheria','comercio','servicos','outros']) test(`coleta ${segmento} sem exigir dados de móveis`,()=>{
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
  assert.match(enviar('oi',true),/Suzy, assistente virtual da Empresa teste/);
  assert.equal(projeto.coleta.geral.solicitacao,undefined);
  enviar('Preciso de manutenção');
  enviar('Visita na segunda-feira');
  enviar('Ana Silva');
  assert.equal(cliente.nome,'Ana Silva');
  assert.equal(projeto.coleta.geral.solicitacao,'Preciso de manutenção');
  assert.equal(projeto.coleta.geral.detalhes,'Visita na segunda-feira');
  assert.equal(situacaoColeta({...projeto,segmento,cliente_nome:cliente.nome}).categoria,'completo');
  enviar('oi');
  assert.equal(projeto.coleta.geral.solicitacao,'Preciso de manutenção');
});
test('marcenaria mantém campos técnicos e dados gerais incompletos continuam em coleta',()=>{
  assert.equal(situacaoColeta({segmento:'marcenaria'}).total_campos,7);
  assert.equal(situacaoColeta({segmento:'servicos'}).total_campos,3);
  assert.equal(situacaoColeta({segmento:'servicos'}).categoria,'em_coleta');
});
