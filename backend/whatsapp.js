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

function configurarEmbeddedSignup(env = process.env) {
  return {
    appId: env.META_APP_ID || env.META_API_ID || env.FACEBOOK_APP_ID || '',
    appSecret: env.META_APP_SECRET || env.FACEBOOK_APP_SECRET || '',
    configId: env.META_EMBEDDED_SIGNUP_CONFIG_ID || env.META_SIGNUP_CONFIG_ID || env.META_CONFIG_ID || env.FACEBOOK_LOGIN_CONFIG_ID || '',
    apiVersion: env.WHATSAPP_API_VERSION || 'v25.0',
  };
}

function mensagensDoWebhook(payload = {}) {
  const mensagens = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const phoneNumberId = String(value.metadata?.phone_number_id || '').trim();
      const displayPhoneNumber = String(value.metadata?.display_phone_number || '').trim();
      for (const msg of value.messages || []) {
        if (msg.type === 'text' && msg.text?.body) mensagens.push({ de: msg.from, texto: msg.text.body, id: msg.id, phoneNumberId, displayPhoneNumber });
      }
    }
  }
  return mensagens;
}

function mascararTelefone(telefone = '') {
  const limpo = String(telefone).replace(/\D/g, '');
  if (!limpo) return 'desconhecido';
  return `***${limpo.slice(-4)}`;
}

function resumoWebhook(payload = {}) {
  const resumo = { entries: 0, changes: 0, campos: [], tipos: [], status: 0 };
  for (const entry of payload.entry || []) {
    resumo.entries += 1;
    for (const change of entry.changes || []) {
      resumo.changes += 1;
      if (change.field) resumo.campos.push(change.field);
      const value = change.value || {};
      for (const msg of value.messages || []) if (msg.type) resumo.tipos.push(msg.type);
      if (Array.isArray(value.statuses)) resumo.status += value.statuses.length;
    }
  }
  return {
    entries: resumo.entries,
    changes: resumo.changes,
    campos: [...new Set(resumo.campos)],
    tipos: [...new Set(resumo.tipos)],
    status: resumo.status,
  };
}

function empresaComConfigWhatsApp(registro, config) {
  const { whatsapp_token, whatsapp_phone_number_id, whatsapp_api_version, ...empresa } = registro;
  empresa.whatsapp = {
    token: whatsapp_token || config.token,
    phoneNumberId: whatsapp_phone_number_id || config.phoneNumberId,
    apiVersion: whatsapp_api_version || config.apiVersion,
  };
  return empresa;
}

async function resolverEmpresaWhatsApp(banco, config = configurarWhatsApp(), phoneNumberId = '') {
  const numeroRecebido = String(phoneNumberId || '').trim();
  if (numeroRecebido) {
    const resultado = await banco.query(
      `SELECT m.id,m.nome,m.slug,m.segmento,m.atividade,'administrador' AS papel,
        w.access_token AS whatsapp_token,w.phone_number_id AS whatsapp_phone_number_id,w.api_version AS whatsapp_api_version
       FROM whatsapp_configuracoes w
       JOIN marcenarias m ON m.id=w.marcenaria_id
       WHERE w.phone_number_id=$1 AND w.ativo=TRUE AND m.ativa=TRUE`,
      [numeroRecebido],
    );
    if (resultado.rows[0]) return empresaComConfigWhatsApp(resultado.rows[0], config);
    if (config.phoneNumberId && numeroRecebido !== config.phoneNumberId) throw erroHttp(503, 'Número do WhatsApp não vinculado a nenhuma empresa.');
  }
  const resultado = config.marcenariaId
    ? await banco.query("SELECT id,nome,slug,segmento,atividade,'administrador' AS papel FROM marcenarias WHERE id=$1 AND ativa=TRUE", [config.marcenariaId])
    : await banco.query("SELECT id,nome,slug,segmento,atividade,'administrador' AS papel FROM marcenarias WHERE slug=$1 AND ativa=TRUE ORDER BY id LIMIT 1", [config.marcenariaSlug]);
  const empresa = resultado.rows[0];
  if (!empresa) throw erroHttp(503, 'Empresa do WhatsApp não configurada.');
  empresa.whatsapp = config;
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

function validarConfiguracaoWhatsApp(body = {}, existente = null, env = process.env) {
  const phoneNumberId = String(body.phone_number_id || '').replace(/\D/g, '');
  if (!/^[0-9]{5,40}$/.test(phoneNumberId)) throw erroHttp(400, 'Informe o Phone Number ID do WhatsApp.');
  const wabaId = String(body.waba_id || '').replace(/\D/g, '').slice(0, 40);
  const numero = String(body.numero || '').trim();
  if (numero.length > 30) throw erroHttp(400, 'Informe um número de WhatsApp menor.');
  const accessToken = typeof body.access_token === 'string' ? body.access_token.trim() : '';
  if (accessToken && accessToken.length > 5000) throw erroHttp(400, 'Token de acesso muito longo.');
  if (!accessToken && !existente?.access_token) throw erroHttp(400, 'Informe o token de acesso da Meta.');
  const apiVersion = String(body.api_version || env.WHATSAPP_API_VERSION || 'v25.0').trim();
  if (!/^v[0-9]+[.][0-9]+$/.test(apiVersion)) throw erroHttp(400, 'Versão da API inválida. Ex.: v25.0');
  return { phoneNumberId, wabaId, numero, accessToken, apiVersion, ativo: body.ativo !== false };
}

function validarConclusaoEmbeddedSignup(body = {}) {
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code || code.length > 2000) throw erroHttp(400, 'Autorização da Meta inválida ou expirada.');
  const wabaId = String(body.waba_id || body.wabaId || '').replace(/\D/g, '');
  const phoneNumberId = String(body.phone_number_id || body.phoneNumberId || '').replace(/\D/g, '');
  if (wabaId && !/^[0-9]{5,40}$/.test(wabaId)) throw erroHttp(400, 'WABA ID inválido.');
  if (phoneNumberId && !/^[0-9]{5,40}$/.test(phoneNumberId)) throw erroHttp(400, 'Phone Number ID inválido.');
  return { code, wabaId, phoneNumberId };
}

async function chamarGraph(caminho, { token = '', method = 'GET', body = null, apiVersion = 'v25.0', consultar = fetch } = {}) {
  const url = caminho.startsWith('https://') ? caminho : `https://graph.facebook.com/${apiVersion}/${caminho.replace(/^\//, '')}`;
  let resposta;
  try {
    resposta = await consultar(url, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw erroHttp(502, 'Não foi possível falar com a Meta agora.');
  }
  let dados = {};
  try { dados = await resposta.json(); } catch {}
  if (!resposta.ok) throw erroHttp(502, 'Não foi possível concluir a conexão com a Meta.');
  return dados;
}

async function trocarCodigoEmbeddedSignup(code, config = configurarEmbeddedSignup(), consultar = fetch) {
  if (!config.appId || !config.appSecret || !config.configId) throw erroHttp(503, 'Embedded Signup da Meta não configurado no servidor.');
  const params = new URLSearchParams({ client_id: config.appId, client_secret: config.appSecret, code });
  const dados = await chamarGraph(`https://graph.facebook.com/${config.apiVersion}/oauth/access_token?${params}`, { consultar });
  if (!dados.access_token) throw erroHttp(502, 'A Meta não retornou o token do WhatsApp.');
  return dados.access_token;
}

async function detalhesNumeroMeta({ token, wabaId, phoneNumberId, config = configurarEmbeddedSignup(), consultar = fetch }) {
  if (phoneNumberId) {
    const numero = await chamarGraph(`${phoneNumberId}?fields=id,display_phone_number`, { token, apiVersion: config.apiVersion, consultar });
    return { phoneNumberId: numero.id || phoneNumberId, numero: numero.display_phone_number || '' };
  }
  if (!wabaId) throw erroHttp(400, 'A Meta não informou o número conectado.');
  const lista = await chamarGraph(`${wabaId}/phone_numbers?fields=id,display_phone_number`, { token, apiVersion: config.apiVersion, consultar });
  const primeiro = lista.data?.[0];
  if (!primeiro?.id) throw erroHttp(400, 'Nenhum número foi conectado pela Meta.');
  return { phoneNumberId: primeiro.id, numero: primeiro.display_phone_number || '' };
}

async function concluirEmbeddedSignup({ banco, empresa, body, consultar = fetch, env = process.env }) {
  const config = configurarEmbeddedSignup(env);
  const entrada = validarConclusaoEmbeddedSignup(body);
  const token = await trocarCodigoEmbeddedSignup(entrada.code, config, consultar);
  const numero = await detalhesNumeroMeta({ token, wabaId: entrada.wabaId, phoneNumberId: entrada.phoneNumberId, config, consultar });
  if (entrada.wabaId) await chamarGraph(`${entrada.wabaId}/subscribed_apps`, { token, method: 'POST', apiVersion: config.apiVersion, consultar });
  const registro = (await banco.query(
    `INSERT INTO whatsapp_configuracoes (marcenaria_id,numero,waba_id,phone_number_id,access_token,api_version,ativo)
     VALUES ($1,$2,$3,$4,$5,$6,TRUE)
     ON CONFLICT (marcenaria_id) DO UPDATE SET
       numero=EXCLUDED.numero,
       waba_id=EXCLUDED.waba_id,
       phone_number_id=EXCLUDED.phone_number_id,
       access_token=EXCLUDED.access_token,
       api_version=EXCLUDED.api_version,
       ativo=TRUE,
       atualizado_em=CURRENT_TIMESTAMP
     RETURNING numero,waba_id,phone_number_id,api_version,ativo,access_token`,
    [empresa.id, numero.numero, entrada.wabaId, numero.phoneNumberId, token, config.apiVersion],
  )).rows[0];
  return registroPublicoWhatsApp(registro);
}

function registroPublicoWhatsApp(registro) {
  return registro ? {
    numero: registro.numero,
    waba_id: registro.waba_id,
    phone_number_id: registro.phone_number_id,
    api_version: registro.api_version,
    ativo: registro.ativo,
    configurado: Boolean(registro.access_token),
  } : { numero: '', waba_id: '', phone_number_id: '', api_version: process.env.WHATSAPP_API_VERSION || 'v25.0', ativo: true, configurado: false };
}

function registrarWhatsAppConfiguracoes(app, banco, rota) {
  app.get('/api/whatsapp-embedded-config', rota(async (req, res) => {
    const config = configurarEmbeddedSignup();
    res.json({
      configurado: Boolean(config.appId && config.configId && config.appSecret),
      app_id: config.appId,
      config_id: config.configId,
      api_version: config.apiVersion,
    });
  }));
  app.get('/api/whatsapp-configuracao', rota(async (req, res) => {
    const registro = (await banco.query('SELECT numero,waba_id,phone_number_id,api_version,ativo,access_token FROM whatsapp_configuracoes WHERE marcenaria_id=$1', [req.marcenaria.id])).rows[0];
    res.json({ whatsapp: registroPublicoWhatsApp(registro) });
  }));
  app.put('/api/whatsapp-configuracao', rota(async (req, res) => {
    if (!['proprietario', 'administrador', 'superadministrador'].includes(req.marcenaria.papel)) throw erroHttp(403, 'Somente administradores podem configurar o WhatsApp.');
    const existente = (await banco.query('SELECT access_token FROM whatsapp_configuracoes WHERE marcenaria_id=$1', [req.marcenaria.id])).rows[0];
    const dados = validarConfiguracaoWhatsApp(req.body, existente);
    try {
      const registro = (await banco.query(
        `INSERT INTO whatsapp_configuracoes (marcenaria_id,numero,waba_id,phone_number_id,access_token,api_version,ativo)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (marcenaria_id) DO UPDATE SET
           numero=EXCLUDED.numero,
           waba_id=EXCLUDED.waba_id,
           phone_number_id=EXCLUDED.phone_number_id,
           access_token=CASE WHEN EXCLUDED.access_token='' THEN whatsapp_configuracoes.access_token ELSE EXCLUDED.access_token END,
           api_version=EXCLUDED.api_version,
           ativo=EXCLUDED.ativo,
           atualizado_em=CURRENT_TIMESTAMP
         RETURNING numero,waba_id,phone_number_id,api_version,ativo,access_token`,
        [req.marcenaria.id, dados.numero, dados.wabaId, dados.phoneNumberId, dados.accessToken, dados.apiVersion, dados.ativo],
      )).rows[0];
      res.json({ whatsapp: registroPublicoWhatsApp(registro) });
    } catch (erro) {
      if (erro.code === '23505') throw erroHttp(409, 'Este Phone Number ID já está conectado em outra empresa.');
      throw erro;
    }
  }));
  app.post('/api/whatsapp-embedded-signup', rota(async (req, res) => {
    if (!['proprietario', 'administrador', 'superadministrador'].includes(req.marcenaria.papel)) throw erroHttp(403, 'Somente administradores podem conectar o WhatsApp.');
    try {
      const whatsapp = await concluirEmbeddedSignup({ banco, empresa: req.marcenaria, body: req.body });
      res.json({ whatsapp });
    } catch (erro) {
      if (erro.code === '23505') throw erroHttp(409, 'Este WhatsApp já está conectado em outra empresa.');
      throw erro;
    }
  }));
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
    const mensagens = mensagensDoWebhook(req.body);
    const resumo = resumoWebhook(req.body);
    logger.log('[WHATSAPP] webhook recebido', JSON.stringify({ ...resumo, mensagens_texto: mensagens.length }));
    if (!mensagens.length) {
      logger.log('[WHATSAPP] sem mensagem de texto para processar', JSON.stringify(resumo));
      return res.json({ recebido: true, mensagens: 0 });
    }
    for (const mensagem of mensagens) {
      const empresa = await resolverEmpresaWhatsApp(banco, config, mensagem.phoneNumberId);
      logger.log('[WHATSAPP] empresa selecionada', JSON.stringify({ id: empresa.id, nome: empresa.nome, slug: empresa.slug, phone_number_id: mensagem.phoneNumberId || empresa.whatsapp?.phoneNumberId || '' }));
      logger.log('[WHATSAPP] processando mensagem', JSON.stringify({ de: mascararTelefone(mensagem.de), empresa_id: empresa.id }));
      const resposta = await responderMensagem({ banco, extrair, logger, telefone: mensagem.de, texto: mensagem.texto, empresa });
      await enviarWhatsApp(mensagem.de, resposta, empresa.whatsapp || config);
      logger.log('[WHATSAPP] resposta enviada', JSON.stringify({ para: mascararTelefone(mensagem.de), empresa_id: empresa.id }));
    }
    res.json({ recebido: true, mensagens: mensagens.length });
  }));
}

module.exports = { configurarWhatsApp, configurarEmbeddedSignup, mensagensDoWebhook, registrarWhatsApp, registrarWhatsAppConfiguracoes, resolverEmpresaWhatsApp, validarConfiguracaoWhatsApp, validarConclusaoEmbeddedSignup, concluirEmbeddedSignup };
