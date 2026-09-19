/**
 * Define os ramos aceitos e a coleta guiada para negócios fora do fluxo técnico específico. Reúne pedido, detalhes e nome sem prometer preço ou prazo.
 */
const { erroHttp } = require('./projetos');
const segmentos = { outros:'Outros ramos', serralheria:'Serralheria e solda', comercio:'Comércio', servicos:'Prestação de serviços', marcenaria:'Marcenaria' };
const assuntoComercial = /\b(preco|valor|custa|custo|orcamento|cotacao|desconto|prazo|entrega)\b|r\$/;
const perguntaIdentidade = /\b(quem e voce|qual (?:e )?(?:o )?seu nome|se apresente)\b/;
const normalizar = texto => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
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
// Ajusta a próxima pergunta ao ramo cadastrado, sem expor rótulos internos ao cliente.
function perguntaDetalhes(empresa = {}) {
  const ramo = normalizar(`${empresa.segmento || ''} ${empresa.atividade || ''}`);
  if (/(clinic|consultorio|medic|odont|dent|fisio|psic|terapia|estet|saude|saud)/.test(ramo)) {
    return 'Certo. Qual atendimento você procura e qual dia ou horário seria melhor?';
  }
  if (/(comerc|loja|varejo|produto|moda|mercado|farmacia|farmacia)/.test(ramo)) {
    return 'Certo. Pode me contar qual produto procura e alguma preferência importante?';
  }
  if (/(marcen|moveis|movel|planejad|serralh|sold|metal|vidrac|construc|reforma|obra)/.test(ramo)) {
    return 'Certo. Pode me contar um pouco mais sobre o que você precisa e onde isso será usado?';
  }
  if (/(servic|assistencia|instal|manutenc|limpez|aula|curso|consultoria)/.test(ramo)) {
    return 'Certo. Pode me contar mais detalhes do serviço e quando você precisa?';
  }
  return 'Certo. Pode me contar mais detalhes do que você precisa?';
}
// Escolhe a próxima informação pendente e apresenta a Suzy com o nome da empresa.
function responderSolicitacao(a,cliente,empresa,primeiroContato) {
  let resposta;
  if(!a.estado.geral.solicitacao) {a.estado.pergunta='solicitacao';resposta='Como posso ajudar hoje?';}
  else if(!a.estado.geral.detalhes){a.estado.pergunta='detalhes_gerais';resposta=perguntaDetalhes(empresa);}
  else if(!(cliente.nome||a.nome)){a.estado.pergunta='nome';resposta='Como posso chamar você?';}
  else {a.estado.pergunta=null;resposta='Seu pedido está registrado para avaliação da equipe. Nesta versão a Suzy não calcula valores nem confirma prazos.';}
  const texto=normalizar(a.texto);
  if(assuntoComercial.test(texto)) resposta=`Nesta versão eu não calculo valores por aqui; registro sua necessidade para a equipe avaliar. ${resposta}`;
  if(primeiroContato||a.saudacao||perguntaIdentidade.test(texto))resposta=`Oi! Sou a Suzy, atendente virtual. ${resposta}`;
  return resposta;
}
module.exports={segmentos,validarSegmento,analisarSolicitacao,responderSolicitacao,perguntaDetalhes};
