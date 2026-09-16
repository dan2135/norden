/**
 * Define os ramos aceitos e a coleta guiada para negócios fora do fluxo técnico específico. Reúne pedido, detalhes e nome sem prometer preço ou prazo.
 */
const { erroHttp } = require('./projetos');
const segmentos = { outros:'Outros ramos', serralheria:'Serralheria e solda', comercio:'Comércio', servicos:'Prestação de serviços', marcenaria:'Marcenaria' };
// Aceita apenas os ramos cadastrados na lista de segmentos.
function validarSegmento(valor='outros') {
  if(!Object.hasOwn(segmentos,valor)) throw erroHttp(400,'Escolha um ramo de atividade válido.');
  return valor;
}
// Atualiza o estado do pedido geral conforme a pergunta anterior, preservando dados já coletados.
function analisarSolicitacao(texto, projeto, cliente) {
  const estado={...projeto.coleta, medidas:{}, duvidas:[], geral:{...projeto.coleta?.geral}};
  const simples=texto.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const saudacao=/^(oi|ola|bom dia|boa tarde|boa noite)[.!\s]*$/.test(simples)||/\b(quem e voce|seu nome|se apresente)\b/.test(simples);
  let nome=null;
  if(!saudacao) {
    if(estado.pergunta==='nome'&&!cliente.nome) {
      if(/^[\p{L}][\p{L} '-]{1,99}$/u.test(texto.trim())) nome=texto.trim();
    } else if(!estado.geral.solicitacao) estado.geral.solicitacao=texto.trim();
    else if(estado.pergunta==='detalhes_gerais') estado.geral.detalhes=texto.trim();
  }
  return {dados:Object.fromEntries(['movel','uso','largura_cm','altura_cm','profundidade_cm','acabamento','detalhes'].map(c=>[c,null])),estado,nome,pendencias:[],descartados:[],texto,saudacao};
}
// Escolhe a próxima informação pendente e apresenta a Suzy com o nome da empresa.
function responderSolicitacao(a,cliente,empresa,primeiroContato) {
  let resposta;
  if(!a.estado.geral.solicitacao) {a.estado.pergunta='solicitacao';resposta=empresa.segmento==='comercio'?'Qual produto você procura?':'Qual serviço ou pedido você gostaria de solicitar?';}
  else if(!a.estado.geral.detalhes){a.estado.pergunta='detalhes_gerais';resposta='Pode me contar mais detalhes do que você precisa?';}
  else if(!(cliente.nome||a.nome)){a.estado.pergunta='nome';resposta='Como posso chamar você?';}
  else {a.estado.pergunta=null;resposta='Seu pedido está registrado para avaliação da equipe. Preços, disponibilidade e prazos precisam ser confirmados pela empresa.';}
  if(primeiroContato||a.saudacao)resposta=`Oi, eu sou a Suzy, assistente virtual da ${empresa.nome}. ${resposta}`;
  return resposta;
}
module.exports={segmentos,validarSegmento,analisarSolicitacao,responderSolicitacao};
