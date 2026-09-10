/**
 * Organiza a conversa de marcenaria por regras: interpreta informações explícitas, guarda pendências e escolhe a próxima pergunta. A IA é apenas um complemento validado.
 */
const { validarTextoAnalise } = require('./seguranca');
const { validarExtracao } = require('./dados-projeto');
const normalizar = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const dimensoes = { largura_cm: 'largura', altura_cm: 'altura', profundidade_cm: 'profundidade' };
const campos = ['movel', 'uso', ...Object.keys(dimensoes), 'acabamento', 'detalhes'];
const moveis = /\b(gaveteiro|giverteiro|gaverteiro|guarda[ -]roupa|armario|mesa|bancada|estante|balcao|painel|prateleira|rack|gabinete|gaveta)\b/;
const locais = /\b(?:no|na|nos|nas|para o|para a)\s+(?:(?:meu|minha|meus|minhas)\s+)?(quarto|sala(?: de jantar| de estar)?|cozinha|banheiro|escritorio|ecritorio|escrtorio|lavanderia|area de servico|varanda)\b/;
const cores = /\b(madeirado|branco|branca|preto|preta|cinza|azul|verde|bege|fosco|fosca|brilhante)\b/g;

// Converte a medida para centímetros quando a unidade é conhecida.
function medida(valor, unidade) {
  const n = Number(String(valor).replace(',', '.'));
  const cm = Math.round(n * ({ m: 100, cm: 1, mm: 0.1 }[unidade]) * 100) / 100;
  return Number.isFinite(cm) && cm > 0 && cm <= 10000 ? cm : null;
}

// Combina o texto atual com o estado da coleta e identifica dados, dúvidas e respostas curtas.
function analisarMensagem(texto, projeto = {}, cliente = {}) {
  validarTextoAnalise(texto);
  texto = texto.trim();
  const s = normalizar(texto.trim());
  const dados = Object.fromEntries(campos.map(c => [c, null]));
  const estado = { medidas: { ...(projeto.coleta?.medidas || {}) }, pergunta: projeto.coleta?.pergunta || null, duvidas: [...(projeto.coleta?.duvidas || [])] };
  const pendencias = [];
  let nome = null;
  const hipotese = /\b(talvez|acho|ou|entre)\b/.test(s);
  const negacao = /\bnao\b/.test(s);
  const nomeMatch = texto.match(/\b(?:me chamo|meu nome [ée])\s+([\p{L}][\p{L} '-]{0,99}?)(?=\s+e\s+|[,.!?]|$)/iu);
  if (nomeMatch && !negacao) nome = nomeMatch[1].trim();
  if (!cliente.nome && estado.pergunta === 'nome' && /^[\p{L}]+(?: [\p{L}]+){0,3}$/u.test(texto.trim())
    && !/^(sim|nao|oi|ola|ok|obrigad[oa])$/.test(s)) nome = texto.trim();

  // Um número sem unidade nunca é gravado por suposição.
  let unidadeConfirmada = null;
  if (Object.keys(estado.medidas).length && !negacao) {
    if (/^(?:sim|isso|isso mesmo|correto|certo)[.!\s]*$/.test(s) && estado.pergunta === 'unidade_cm') unidadeConfirmada = 'cm';
    const u = s.match(/^(?:(?:sim|isso)[,\s]+)?(?:(?:tudo|todas|todos|sao|e|as medidas)\s+)?(?:em\s+)?(cm|centimetros|m|metros|mm|milimetros)[.!\s]*$/);
    if (u) unidadeConfirmada = { centimetros: 'cm', metros: 'm', milimetros: 'mm' }[u[1]] || u[1];
  }
  if (unidadeConfirmada) {
    for (const [c, valor] of Object.entries(estado.medidas)) {
      const cm = medida(valor, unidadeConfirmada);
      if (cm !== null) dados[c] = cm; else pendencias.push(c);
    }
    estado.medidas = {};
  }

  const medidasTexto = s.replace(/\blarguda\b/g, 'largura').replace(/\bcentimetros?\b/g, 'cm').replace(/\bmilimetros?\b/g, 'mm').replace(/\bmetros?\b/g, 'm');
  const unidadeGeral = s.match(/(?:tudo|todas as medidas|medidas)\s+em\s+(mm|cm|m)\b/)?.[1];
  const intervalo = /\d\s*(?:mm|cm|m)?\s*(?:a|ate|[-–])\s*\d/.test(s);
  // Varre da esquerda para a direita: um número nunca pertence a duas dimensões.
  const pares = [...medidasTexto.matchAll(/\b(largura|altura|profundidade)\s{0,8}(?:de|e|:|=)?\s{0,8}(?:uns?|umas?)?\s{0,8}(-?\d{1,8}(?:[.,]\d{1,6})?)\s{0,8}(mm|cm|m)?\b|(?<![\d.,])(-?\d{1,8}(?:[.,]\d{1,6})?)\s{0,8}(mm|cm|m)?\s{0,8}(?:de\s{1,8})?(largura|altura|profundidade)\b/g)]
    .map(m => ({ rotulo: m[1] || m[6], valor: m[2] || m[4], unidade: m[3] || m[5] || unidadeGeral }));
  for (const [campo, rotulo] of Object.entries(dimensoes)) {
    let valores = pares.filter(p => p.rotulo === rotulo).map(p => ({ valor: p.valor, unidade: p.unidade }));
    if (!valores.length && estado.pergunta === campo) {
      const simples = s.match(/^(-?\d+(?:[.,]\d+)?)\s*(mm|cm|m)?[.!\s]*$/);
      if (simples) valores = [{ valor: simples[1], unidade: simples[2] }];
    }
    if (!valores.length) continue;
    const unicos = [...new Map(valores.map(v => [JSON.stringify(v), v])).values()];
    delete estado.medidas[campo];
    if (unicos.length !== 1 || hipotese || intervalo || negacao) { pendencias.push(campo); continue; }
    const v = unicos[0];
    if (Number(v.valor.replace(',', '.')) <= 0) { pendencias.push(campo); continue; }
    if (!v.unidade) estado.medidas[campo] = v.valor;
    else {
      const cm = medida(v.valor, v.unidade);
      if (cm === null) pendencias.push(campo); else dados[campo] = cm;
    }
  }
  if (/\d\s*(?:x|×|por)\s*\d/.test(s)) pendencias.push('medidas');

  if (!hipotese && !negacao) {
    const movel = s.match(moveis);
    const pedido = !projeto.movel || /\b(?:quero|gostaria|preciso|na verdade|trocar|mudar|corrigindo)\b/.test(s);
    if (movel && pedido && !/\b(?:ele|ela)\s+tenha\b/.test(s)) {
      dados.movel = /^(?:giverteiro|gaverteiro)$/.test(movel[1]) ? 'gaveteiro' : texto.slice(movel.index, movel.index + movel[1].length);
    }
    const local = s.match(locais);
    if (local) dados.uso = /^(?:ecritorio|escrtorio)$/.test(local[1]) ? 'escritório' : texto.slice(local.index + local[0].length - local[1].length, local.index + local[0].length);
    if (!local && estado.pergunta === 'uso' && /^(quarto|sala|cozinha|banheiro|escritorio|lavanderia|varanda)$/.test(s)) dados.uso = texto.trim();
    const acabamento = [...s.matchAll(cores)].map(m => texto.slice(m.index, m.index + m[0].length));
    if (acabamento.length) dados.acabamento = acabamento.join(' ');
    const detalhe = texto.match(/\b(?:tenha|com)\s+((?:(?:\d+|uma?|duas?|tres|três|quatro)\s+)?(?:rodinhas?|rod[ií]zios?|gavetas?|portas?|prateleiras?)[^.!?]*)/i);
    if (detalhe && detalhe[1].length <= 1000) dados.detalhes = detalhe[1].trim();
  }
  if ((hipotese || negacao) && [...s.matchAll(cores)].length) pendencias.push('acabamento');

  // Preserva outros detalhes em mensagens aditivas; não substitui silenciosamente.
  if (dados.detalhes && projeto.detalhes && !normalizar(projeto.detalhes).includes(normalizar(dados.detalhes))) {
    dados.detalhes = `${projeto.detalhes}; ${dados.detalhes}`.slice(0, 2000);
  }
  estado.duvidas = [...new Set([...estado.duvidas, ...pendencias])].filter(c => dados[c] == null);
  if (Object.keys(dimensoes).some(c => dados[c] !== null || estado.medidas[c])) estado.duvidas = estado.duvidas.filter(c => c !== 'medidas');
  return { dados, estado, nome, pendencias: estado.duvidas, descartados: [], texto };
}

// Aproveita apenas sugestões validadas do modelo, preservando a análise determinística.
function complementarComIA(analise, extraido, historico, projeto) {
  validarTextoAnalise(analise.texto);
  const validado = validarExtracao(extraido, historico);
  analise.descartados = validado.pendencias;
  // A IA é apoio, não decide a pergunta nem substitui campos já conhecidos.
  // Medidas são exclusivamente interpretadas pelo analisador de unidades.
  for (const campo of ['movel', 'uso', 'acabamento', 'detalhes']) {
    if (analise.dados[campo] || projeto[campo] || !validado.dados[campo]) continue;
    const s = normalizar(analise.texto);
    const autorizado = { movel: /\b(?:quero|gostaria|preciso)\b.*\b(?:fazer|um|uma)\b/.test(s) && !/\b(?:ele|ela|altura|largura|profundidade)\b/.test(s),
      uso: /^(?:no|na|para o|para a)\s/.test(s), acabamento: /\b(?:acabamento|cor)\b/.test(s), detalhes: /\b(?:detalhe|tenha)\b/.test(s) }[campo];
    if (autorizado) analise.dados[campo] = validado.dados[campo];
    else analise.descartados.push(campo);
  }
  return analise;
}

// Escolhe a próxima pergunta sem pedir novamente campos já confirmados.
function responder(analise, projeto, cliente, contexto = {}) {
  const p = { ...projeto };
  for (const [c, v] of Object.entries(analise.dados)) if (v !== null) p[c] = v;
  const estado = analise.estado;
  let resposta;
  const perguntar = (campo, texto) => { estado.pergunta = campo; return texto; };
  if (analise.pendencias.length) {
    const c = analise.pendencias[0];
    resposta = c === 'medidas' ? perguntar('largura_cm', 'Para não inverter as medidas, qual é a largura e sua unidade?')
      : c === 'acabamento' ? perguntar(c, 'Qual acabamento você decidiu usar?')
        : perguntar(c, `Pode confirmar a ${dimensoes[c]} com a unidade, por exemplo 80 cm?`);
  } else if (Object.keys(estado.medidas).length) {
    const resumo = Object.entries(estado.medidas).map(([c, v]) => `${dimensoes[c]} ${v}`).join(', ');
    resposta = /^n[aã]o\b/i.test(analise.texto) ? perguntar('unidade', 'Qual é a unidade dessas medidas: cm, m ou mm?')
      : perguntar('unidade_cm', `Anotei ${resumo}, ainda sem unidade. Essas medidas são em centímetros?`);
  } else if (!p.movel) resposta = perguntar('movel', 'Qual móvel você gostaria de fazer?');
  else if (!p.uso) resposta = perguntar('uso', `Em qual ambiente ficará o ${p.movel}?`);
  else if (!p.largura_cm) resposta = perguntar('largura_cm', 'Qual é a largura desejada? Informe a unidade, por exemplo 30 cm.');
  else if (!p.altura_cm) resposta = perguntar('altura_cm', 'Qual é a altura desejada? Informe a unidade, por exemplo 80 cm.');
  else if (!p.profundidade_cm) resposta = perguntar('profundidade_cm', 'Qual é a profundidade desejada? Informe a unidade, por exemplo 30 cm.');
  else if (!p.acabamento) resposta = perguntar('acabamento', 'Você tem preferência de cor ou acabamento?');
  else if (!(analise.nome || cliente.nome)) resposta = perguntar('nome', 'Como posso chamar você?');
  else { estado.pergunta = null; resposta = 'Os dados principais estão registrados para análise do marceneiro. Valores, materiais disponíveis e prazo precisam ser confirmados por ele.'; }
  if (/\b(preco|valor|custa|orcamento|prazo|entrega)\b/.test(normalizar(analise.texto))) resposta = `Preço e prazo dependem da análise do marceneiro. ${resposta}`;
  const texto = normalizar(analise.texto);
  const apresentacao = contexto.primeiroContato || /^(oi|ola|bom dia|boa tarde|boa noite)[.!\s]*$/.test(texto)
    || /\b(quem e voce|qual (?:e )?(?:o )?seu nome|se apresente)\b/.test(texto);
  if (apresentacao) {
    const empresa = contexto.marcenaria?.trim();
    resposta = `Oi, eu sou a Suzy, assistente virtual ${empresa ? `da ${empresa}` : 'da sua marcenaria'}. ${resposta}`;
  }
  return resposta;
}

module.exports = { analisarMensagem, complementarComIA, responder, medida };
