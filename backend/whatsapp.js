/**
 * Webhook da WhatsApp Cloud API. Recebe mensagens de texto, usa o fluxo da Suzy e responde pelo número configurado.
 */
const { analisarMensagem, complementarComIA, responder } = require('./coleta');
const { analisarSolicitacao, responderSolicitacao } = require('./segmentos');
const { validarTelefone, selecionarProjeto, obterCliente, historicoProjeto, erroHttp } = require('./projetos');

function configurarWhatsApp(env = process.env) {
  return {
    token: env.WHATSAPP_TOKEN || '',
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '',
    verifyToken: env.WHATSAPP_VERIFY_TOKEN || '',
    apiVersion: env.WHATSAPP_API_VERSION || 'v25.0',
    marcenariaId: env.WHATSAPP_MARCENARIA_ID || '',
    marcenariaSlug: env.WHATSAPP_MARCENARIA_SLUG || 'principal',
  };
}

function mensagensDoWebhook(payload = {}) {
  const mensagens = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const msg of value.messages || []) {
        if (msg.type === 'text' && msg.text?.body) mensagens.push({ de: msg.from, texto: msg.text.body, id: msg.id });
      }
    }
  }
  return mensagens;
}

async function resolverEmpresaWhatsApp(banco, config = configurarWhatsApp()) {
  const resultado = config.marcenariaId
    ? await banco.query("SELECT id,nome,slug,segmento,'administrador' AS papel FROM marcenarias WHERE id=$1 AND ativa=TRUE", [config.marcenariaId])
    : await banco.query("SELECT id,nome,slug,segmento,'administrador' AS papel FROM marcenarias WHERE slug=$1 AND ativa=TRUE ORDER BY id LIMIT 1", [config.marcenariaSlug]);
  const empresa = resultado.rows[0];
  if (!empresa) throw erroHttp(503, 'Empresa do WhatsApp não configurada.');
  return empresa;
}

async function enviarWhatsApp(para, texto, config = configurarWhatsApp()) {
  if (!config.token || !config.phoneNumberId) throw erroHttp(503, 'WhatsApp não configurado no servidor.');
  const resposta = await fetch(`https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'text',
      text: { preview_url: false, body: texto.slice(0, 4000) },
    }),
  });
  if (!resposta.ok) throw erroHttp(502, 'Não foi possível enviar mensagem pelo WhatsApp.');
}

async function responderMensagem({ banco, extrair, logger, telefone, texto, empresa }) {
  const telefoneValidado = validarTelefone(telefone);
  const db = await banco.connect();
  try {
    await db.query('BEGIN');
    const cliente = await obterCliente(db, telefoneValidado, empresa.id);
    const projetoSelecionado = await selecionarProjeto(db, cliente.id, undefined, empresa.id);
    await db.query(
      'INSERT INTO mensagens (cliente_id, projeto_id, remetente, texto,marcenaria_id) VALUES ($1,$2,$3,$4,$5)',
      [cliente.id, projetoSelecionado.id, 'cliente', texto.trim(), empresa.id],
    );
    const historicoBanco = { rows: await historicoProjeto(db, cliente.id, projetoSelecionado.id, empresa.id) };
    const historico = historicoBanco.rows.map(item => ({ role: item.remetente === 'cliente' ? 'user' : 'assistant', content: item.texto }));
    const geral = (empresa.segmento || 'marcenaria') !== 'marcenaria';
    const analise = geral ? analisarSolicitacao(texto.trim(), projetoSelecionado, cliente) : analisarMensagem(texto.trim(), projetoSelecionado, cliente);
    const precisaIA = !Object.values(analise.dados).some(v => v !== null) && !analise.nome
      && !analise.pendencias.length && !Object.keys(analise.estado.medidas).length
      && !/^(oi|ol[aá]|bom dia|boa tarde|boa noite|sim|ok|obrigad[oa])[.!\s]*$/i.test(texto.trim());
    if (precisaIA && !geral) {
      try { complementarComIA(analise, await extrair(historico), historico, projetoSelecionado); }
      catch (erro) { analise.descartados.push('IA indisponível'); logger.warn('[WHATSAPP IA]', erro.message); }
    }
    const primeiroContato = !historicoBanco.rows.some(item => item.remetente === 'sistema');
    let respostaSistema = geral ? responderSolicitacao(analise, cliente, empresa, primeiroContato) : responder(analise, projetoSelecionado, cliente, { marcenaria: empresa.nome, primeiroContato });
    if (process.env.IA_PROVIDER === 'openai') {
      try { respostaSistema = await require('./openai').responderComOpenAI({ historico, empresa, respostaBase: respostaSistema }); }
      catch (erro) { logger.warn('[WHATSAPP IA] Resposta guiada utilizada:', erro.message); }
    }
    await db.query(
      `UPDATE projetos SET movel=COALESCE($1,movel),uso=COALESCE($2,uso),largura_cm=COALESCE($3,largura_cm),
       altura_cm=COALESCE($4,altura_cm),profundidade_cm=COALESCE($5,profundidade_cm),acabamento=COALESCE($6,acabamento),
       detalhes=COALESCE($7,detalhes),coleta=$8::jsonb,atualizado_em=CURRENT_TIMESTAMP WHERE id=$9 AND marcenaria_id=$10`,
      [analise.dados.movel, analise.dados.uso, analise.dados.largura_cm, analise.dados.altura_cm, analise.dados.profundidade_cm, analise.dados.acabamento, analise.dados.detalhes, JSON.stringify(analise.estado), projetoSelecionado.id, empresa.id],
    );
    await db.query(
      'INSERT INTO mensagens (cliente_id, projeto_id, remetente, texto,marcenaria_id) VALUES ($1,$2,$3,$4,$5)',
      [cliente.id, projetoSelecionado.id, 'sistema', respostaSistema, empresa.id],
    );
    await db.query('UPDATE clientes SET ultima_mensagem=$1,nome=COALESCE($2,nome) WHERE id=$3 AND marcenaria_id=$4', [texto.trim(), analise.nome, cliente.id, empresa.id]);
    await db.query('COMMIT');
    return respostaSistema;
  } catch (erro) {
    await db.query('ROLLBACK');
    throw erro;
  } finally {
    db.release();
  }
}

function registrarWhatsApp(app, banco, rota, { extrair, logger = console } = {}) {
  app.get('/api/webhooks/whatsapp', (req, res) => {
    const config = configurarWhatsApp();
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.verifyToken) return res.status(200).send(req.query['hub.challenge']);
    return res.sendStatus(403);
  });
  app.post('/api/webhooks/whatsapp', rota(async (req, res) => {
    const config = configurarWhatsApp();
    const empresa = await resolverEmpresaWhatsApp(banco, config);
    for (const mensagem of mensagensDoWebhook(req.body)) {
      const resposta = await responderMensagem({ banco, extrair, logger, telefone: mensagem.de, texto: mensagem.texto, empresa });
      await enviarWhatsApp(mensagem.de, resposta, config);
    }
    res.json({ recebido: true });
  }));
}

module.exports = { configurarWhatsApp, mensagensDoWebhook, registrarWhatsApp, resolverEmpresaWhatsApp };
