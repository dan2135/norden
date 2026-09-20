/**
 * Define os ramos aceitos e a coleta guiada para negócios fora do fluxo técnico específico. Reúne pedido, detalhes e nome sem prometer preço ou prazo.
 */
const { erroHttp } = require('./projetos');
const segmentos = { outros:'Outros ramos', serralheria:'Serralheria e solda', comercio:'Comércio', servicos:'Prestação de serviços', marcenaria:'Marcenaria' };
const perguntaIdentidade = /\b(quem e voce|qual (?:e )?(?:o )?seu nome|se apresente)\b/;
const intencaoAlteracao = /\b(alterar|alteracao|alteracoes|mudanca|mudancas|mudar|modificar|ajustar|trocar|corrigir|correcao|correcoes|editar|atualizar)\b/;
const intencaoAcrescimo = /\b(acrescentar|adicionar|incluir|colocar|somar)\b|\b(?:outro|outra|mais um|mais uma|mais uns|mais umas)\b/;
const normalizar = texto => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const perfisAtendimento = [
  { chave:'saude', padrao:/(clinic|consultorio|medic|odont|dent|fisio|psic|terapia|saude|saud|nutri|fono|exame|laboratorio)/,
    detalhes:'Certo. Qual atendimento você procura e qual dia ou horário seria melhor?' },
  { chave:'estetica', padrao:/(estet|beleza|salao|barbear|cabelo|unha|sobrancelha|massagem|spa)/,
    detalhes:'Certo. Qual procedimento você procura e qual dia ou horário seria melhor?' },
  { chave:'pet', padrao:/(pet|veterin|banho|tosa|animal|cao|cachorro|gato)/,
    detalhes:'Certo. Qual serviço seu pet precisa e qual dia ou horário seria melhor?' },
  { chave:'metal', padrao:/(metalurg|serralh|sold|ferro|aco|aluminio|caldeiraria|portao|grade|corrimao|estrutura metalica|esquadria)/,
    detalhes:'Certo. É portão, grade, corrimão, estrutura ou outro serviço? Me conta também se é fabricação, instalação ou conserto.' },
  { chave:'marcenaria', padrao:/(marcen|moveis|movel|planejad|madeira|mdf|armario|bancada|painel|guarda roupa)/,
    detalhes:'Certo. É móvel planejado, reparo ou instalação? Me conta onde será usado e o que você imaginou.' },
  { chave:'vidracaria', padrao:/(vidrac|vidro|box|espelho|janela|porta de vidro|blindex)/,
    detalhes:'Certo. É instalação, troca ou reparo? Me conta qual peça precisa e onde será usada.' },
  { chave:'obra', padrao:/(construc|reforma|obra|pintura|pedreiro|eletric|hidraul|gesso|drywall|telhado)/,
    detalhes:'Certo. Que tipo de serviço você precisa e em qual local será feito?' },
  { chave:'automotivo', padrao:/(auto|oficina|mecan|funilar|pintura automotiva|carro|moto|veiculo|veiculo)/,
    detalhes:'Certo. Qual é o veículo e qual serviço ou problema você quer verificar?' },
  { chave:'educacao', padrao:/(aula|curso|escola|professor|reforco|treinamento|idioma)/,
    detalhes:'Certo. Qual aula ou curso você procura e qual horário seria melhor?' },
  { chave:'alimentacao', padrao:/(restaurante|lanchonete|pizzaria|delivery|comida|buffet|bolo|doceria|padaria)/,
    detalhes:'Certo. Você quer fazer pedido, reserva ou tirar dúvida sobre algum item?' },
  { chave:'comercio', padrao:/(comerc|loja|varejo|produto|moda|mercado|farmacia|farmacia|ecommerce|e-commerce)/,
    detalhes:'Certo. Pode me contar qual produto procura e alguma preferência importante?' },
  { chave:'servicos', padrao:/(servic|assistencia|instal|manutenc|limpez|consultoria|suporte)/,
    detalhes:'Certo. Pode me contar mais detalhes do serviço e quando você precisa?' },
];
// Aceita apenas os ramos cadastrados na lista de segmentos.
function validarSegmento(valor='outros') {
  if(!Object.hasOwn(segmentos,valor)) throw erroHttp(400,'Escolha um ramo de atividade válido.');
  return valor;
}
// Junta novas informações sem apagar o que a conversa anterior já tinha registrado.
function anexarDetalhe(atual, texto) {
  const detalhe = String(texto || '').trim();
  if (!detalhe) return atual;
  if (!atual) return detalhe.slice(0, 2000);
  if (normalizar(atual).includes(normalizar(detalhe))) return atual;
  return `${atual}; ${detalhe}`.slice(0, 2000);
}
// Frases como "quero fazer uma alteração" dizem a intenção, mas ainda não dizem o que muda.
function detalheVago(simples) {
  const compacto = simples
    .replace(/\b(oi|ola|eu|mas|so|só|queria|quero|gostaria|preciso|fazer|uma|um|umas|uns|agora|agr|alterar|alteracao|alteracoes|mudanca|mudancas|mudar|modificar|ajustar|trocar|corrigir|correcao|correcoes|editar|atualizar|acrescentar|adicionar|incluir|colocar|somar|outro|outra|mais|movel|móvel|item|coisa|pedido)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
  return compacto.length < 3;
}
function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}
// Atualiza o estado do pedido geral conforme a pergunta anterior, preservando dados já coletados.
function analisarSolicitacao(texto, projeto, cliente) {
  const estado={...projeto.coleta, medidas:{}, duvidas:[], geral:{...projeto.coleta?.geral}};
  const simples=texto.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const saudacao=/^(oi|ola|bom dia|boa tarde|boa noite)[.!\s]*$/.test(simples)||/\b(quem e voce|seu nome|se apresente)\b/.test(simples);
  let nome=null;
  let acao=null;
  if(!saudacao) {
    const nomeDeclarado = texto.match(/\b(?:me chamo|meu nome [ée])\s+([\p{L}][\p{L} '-]{0,99}?)(?=\s+e\s+|[,.!?]|$)/iu);
    if(estado.pergunta==='nome'&&!cliente.nome) {
      if(nomeDeclarado) nome=nomeDeclarado[1].trim();
      else if(/^[\p{L}][\p{L} '-]{1,99}$/u.test(texto.trim())) nome=texto.trim();
    } else if(estado.pergunta==='alteracao_detalhes'||estado.pergunta==='acrescimo_detalhes') {
      const tipo=intencaoAcrescimo.test(simples)?'acrescimo':intencaoAlteracao.test(simples)?'alteracao':estado.pergunta==='acrescimo_detalhes'?'acrescimo':'alteracao';
      if(detalheVago(simples)) { estado.geral.pendente=tipo; acao=`${tipo}_pendente`; }
      else {
        estado.geral.detalhes=anexarDetalhe(estado.geral.detalhes, `${tipo==='acrescimo'?'Acréscimo':'Alteração'} solicitada: ${texto.trim()}`);
        delete estado.geral.pendente;
        acao=`${tipo}_registrado`;
      }
    } else if(estado.geral.solicitacao && (intencaoAlteracao.test(simples)||intencaoAcrescimo.test(simples))) {
      const tipo=intencaoAcrescimo.test(simples)?'acrescimo':'alteracao';
      if(detalheVago(simples)) { estado.geral.pendente=tipo; acao=`${tipo}_pendente`; }
      else {
        estado.geral.detalhes=anexarDetalhe(estado.geral.detalhes, `${tipo==='acrescimo'?'Acréscimo':'Alteração'} solicitada: ${texto.trim()}`);
        delete estado.geral.pendente;
        acao=`${tipo}_registrado`;
      }
    } else if(!estado.geral.solicitacao) estado.geral.solicitacao=texto.trim();
    else if(estado.pergunta==='detalhes_gerais') estado.geral.detalhes=texto.trim();
  }
  return {dados:Object.fromEntries(['movel','uso','largura_cm','altura_cm','profundidade_cm','acabamento','detalhes'].map(c=>[c,null])),estado,nome,pendencias:[],descartados:[],texto,saudacao,acao};
}
// Ajusta a próxima pergunta ao ramo cadastrado, sem expor rótulos internos ao cliente.
function perfilAtendimento(empresa = {}) {
  const ramo = normalizar(`${empresa.segmento || ''} ${empresa.atividade || ''}`);
  return perfisAtendimento.find(perfil => perfil.padrao.test(ramo)) || { chave:'geral', detalhes:'Certo. Pode me contar mais detalhes do que você precisa?' };
}
function perguntaDetalhes(empresa = {}) {
  return perfilAtendimento(empresa).detalhes;
}
// Escolhe a próxima informação pendente e apresenta a Suzy com o nome da empresa.
function responderSolicitacao(a,cliente,empresa,primeiroContato) {
  let resposta;
  const nome = primeiroNome(a.nome || cliente.nome);
  if(a.acao==='alteracao_pendente'||a.estado.geral.pendente==='alteracao') {
    a.estado.pergunta='alteracao_detalhes';
    resposta='Claro. Me conta o que você quer alterar no pedido.';
  } else if(a.acao==='acrescimo_pendente'||a.estado.geral.pendente==='acrescimo') {
    a.estado.pergunta='acrescimo_detalhes';
    resposta='Claro. Me conta o que você quer acrescentar.';
  } else if(a.acao==='alteracao_registrado') {
    a.estado.pergunta=null;
    resposta='Certo, anotei essa alteração. Se quiser, pode me passar mais algum detalhe agora.';
  } else if(a.acao==='acrescimo_registrado') {
    a.estado.pergunta=null;
    resposta='Certo, anotei esse acréscimo. Se quiser, pode me passar mais algum detalhe agora.';
  } else if(a.saudacao && a.estado.geral.solicitacao && a.estado.geral.detalhes) {
    a.estado.pergunta='continuidade';
    resposta=`Oi${nome ? `, ${nome}` : ''}! Como posso ajudar agora?`;
  } else if(!a.estado.geral.solicitacao) {a.estado.pergunta='solicitacao';resposta='Como posso ajudar hoje?';}
  else if(!a.estado.geral.detalhes){a.estado.pergunta='detalhes_gerais';resposta=perguntaDetalhes(empresa);}
  else if(!(cliente.nome||a.nome)){a.estado.pergunta='nome';resposta='Como posso chamar você?';}
  else {a.estado.pergunta=null;resposta='Perfeito, registrei as informações para a equipe continuar seu atendimento.';}
  const texto=normalizar(a.texto);
  if(primeiroContato||perguntaIdentidade.test(texto))resposta=`Oi! Sou a Suzy, atendente virtual. ${resposta}`;
  return resposta;
}
module.exports={segmentos,validarSegmento,analisarSolicitacao,responderSolicitacao,perguntaDetalhes,perfilAtendimento};
