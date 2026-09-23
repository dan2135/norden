/**
 * Integração de assinaturas com o Asaas. Mantém a chave somente no backend e usa webhooks para refletir pagamentos no banco.
 */
const { erroHttp } = require('./projetos');
const { validarDocumento } = require('./auth');

const statusPago = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_AUTHORIZED']);
const statusProblema = new Set(['PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_REFUNDED', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS']);

function configurarAsaas(env = process.env) {
  const trialSolicitado = Number.parseInt(env.NORDEN_TRIAL_DIAS || '15', 10);
  const trialDias = Number.isFinite(trialSolicitado) && trialSolicitado > 0 ? Math.min(trialSolicitado, 15) : 15;
  return {
    apiKey: env.ASAAS_API_KEY || '',
    baseUrl: (env.ASAAS_BASE_URL || env.ASAAS_BASE_UR || 'https://api.asaas.com/v3').replace(/\/+$/, ''),
    webhookToken: env.ASAAS_WEBHOOK_TOKEN || '',
    valorCentavos: Math.max(0, Number.parseInt(env.NORDEN_PLANO_VALOR || '11000', 10) || 11000),
    trialDias,
  };
}

function dataFutura(dias) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

function centavosParaReais(centavos) {
  return Math.round(centavos) / 100;
}

function somenteDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function validarDocumentoCobranca(...valores) {
  const valor = valores.find(item => typeof item === 'string' && item.trim());
  if (!valor) throw erroHttp(400, 'Informe CPF ou CNPJ para ativar a assinatura no Asaas.');
  return validarDocumento(valor);
}

function validarFormaPagamento(body = {}) {
  const billingType = body.billingType === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX';
  if (billingType === 'PIX') return { billingType };
  const cartao = body.creditCard || {};
  const titular = body.creditCardHolderInfo || {};
  const dados = {
    billingType,
    creditCard: {
      holderName: String(cartao.holderName || '').trim(),
      number: somenteDigitos(cartao.number),
      expiryMonth: somenteDigitos(cartao.expiryMonth).padStart(2, '0'),
      expiryYear: somenteDigitos(cartao.expiryYear),
      ccv: somenteDigitos(cartao.ccv),
    },
    creditCardHolderInfo: {
      name: String(titular.name || cartao.holderName || '').trim(),
      email: String(titular.email || '').trim().toLowerCase(),
      cpfCnpj: somenteDigitos(titular.cpfCnpj),
      postalCode: somenteDigitos(titular.postalCode),
      addressNumber: String(titular.addressNumber || '').trim(),
      phone: somenteDigitos(titular.phone),
      mobilePhone: somenteDigitos(titular.mobilePhone || titular.phone),
    },
  };
  if (!dados.creditCard.holderName || dados.creditCard.number.length < 13 || !dados.creditCard.expiryMonth || dados.creditCard.expiryYear.length < 4 || dados.creditCard.ccv.length < 3) {
    throw erroHttp(400, 'Preencha os dados do cartão.');
  }
  if (!dados.creditCardHolderInfo.name || !dados.creditCardHolderInfo.email || !dados.creditCardHolderInfo.cpfCnpj || !dados.creditCardHolderInfo.postalCode || !dados.creditCardHolderInfo.addressNumber || !dados.creditCardHolderInfo.phone) {
    throw erroHttp(400, 'Preencha os dados do titular do cartão.');
  }
  return dados;
}

function validarPlano(config) {
  if (!config.apiKey) throw erroHttp(503, 'Chave do Asaas não configurada no servidor.');
  if (!/^https:\/\/.+/i.test(config.baseUrl)) throw erroHttp(503, 'URL do Asaas precisa ser HTTPS.');
}

async function chamarAsaas(caminho, opcoes = {}, config = configurarAsaas()) {
  validarPlano(config);
  const sinalTimeout = !opcoes.signal && typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(70000)
    : undefined;
  let resposta;
  try {
    resposta = await fetch(`${config.baseUrl}${caminho}`, {
      ...opcoes,
      signal: opcoes.signal || sinalTimeout,
      headers: { access_token: config.apiKey, 'Content-Type': 'application/json', ...(opcoes.headers || {}) },
    });
  } catch (erro) {
    if (erro.name === 'AbortError' || erro.name === 'TimeoutError') throw erroHttp(504, 'O Asaas demorou para responder. Tente novamente em instantes.');
    throw erroHttp(502, 'Não foi possível comunicar com o Asaas.');
  }
  const texto = await resposta.text();
  let dados = {};
  if (texto) {
    try { dados = JSON.parse(texto); } catch { throw erroHttp(502, 'Asaas respondeu em formato inesperado.'); }
  }
  if (!resposta.ok) {
    const mensagem = dados.errors?.[0]?.description || dados.message || 'Não foi possível comunicar com o Asaas.';
    throw erroHttp(502, mensagem);
  }
  return dados;
}

async function assinaturaAtual(banco, marcenariaId) {
  let assinatura = (await banco.query('SELECT * FROM assinaturas WHERE marcenaria_id=$1', [marcenariaId])).rows[0];
  if (!assinatura) {
    const config = configurarAsaas();
    assinatura = (await banco.query(
      `INSERT INTO assinaturas (marcenaria_id,valor_centavos,trial_fim_em)
       VALUES ($1,$2,CURRENT_TIMESTAMP + ($3::text || ' days')::interval) RETURNING *`,
      [marcenariaId, config.valorCentavos, config.trialDias],
    )).rows[0];
  }
  return assinatura;
}

async function iniciarAssinatura(banco, usuario, marcenaria, opcoes = {}) {
  const config = configurarAsaas();
  validarPlano(config);
  const pagamento = validarFormaPagamento(opcoes);
  const db = await banco.connect();
  try {
    await db.query('BEGIN');
    let assinatura = (await db.query('SELECT * FROM assinaturas WHERE marcenaria_id=$1 FOR UPDATE', [marcenaria.id])).rows[0];
    if (!assinatura) {
      assinatura = (await db.query(
        `INSERT INTO assinaturas (marcenaria_id,valor_centavos,trial_fim_em)
         VALUES ($1,$2,CURRENT_TIMESTAMP + ($3::text || ' days')::interval) RETURNING *`,
        [marcenaria.id, config.valorCentavos, config.trialDias],
      )).rows[0];
    }

    let customerId = assinatura.asaas_customer_id;
    const usuarioDocumento = (await db.query('SELECT documento FROM usuarios WHERE id=$1 FOR UPDATE', [usuario.id])).rows[0]?.documento;
    const documento = validarDocumentoCobranca(usuarioDocumento, opcoes.cpfCnpj, pagamento.creditCardHolderInfo?.cpfCnpj);
    if (!usuarioDocumento) {
      try {
        await db.query('UPDATE usuarios SET documento=$1 WHERE id=$2 AND documento IS NULL', [documento, usuario.id]);
      } catch (erro) {
        if (erro.code === '23505') throw erroHttp(409, 'Este CPF/CNPJ já está cadastrado em outra conta.');
        throw erro;
      }
    }
    if (!customerId) {
      const cliente = await chamarAsaas('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: marcenaria.nome,
          email: usuario.email,
          cpfCnpj: documento,
          mobilePhone: pagamento.creditCardHolderInfo?.mobilePhone || undefined,
          externalReference: `norden-marcenaria-${marcenaria.id}`,
        }),
      }, config);
      customerId = cliente.id;
    }

    let subscriptionId = assinatura.asaas_subscription_id;
    if (!subscriptionId) {
      const subscription = await chamarAsaas('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          customer: customerId,
          billingType: pagamento.billingType,
          value: centavosParaReais(config.valorCentavos),
          nextDueDate: dataFutura(config.trialDias),
          cycle: 'MONTHLY',
          description: 'Plano Norden Pro',
          externalReference: `norden-marcenaria-${marcenaria.id}`,
          ...(pagamento.billingType === 'CREDIT_CARD' ? {
            creditCard: pagamento.creditCard,
            creditCardHolderInfo: pagamento.creditCardHolderInfo,
            remoteIp: opcoes.remoteIp || '127.0.0.1',
          } : {}),
        }),
      }, config);
      subscriptionId = subscription.id;
    }

    assinatura = (await db.query(
      `UPDATE assinaturas SET asaas_customer_id=$1,asaas_subscription_id=$2,status=CASE WHEN status='cancelado' THEN 'ativo' ELSE status END,
       valor_centavos=$3,proxima_cobranca_em=$4,billing_type=$5,atualizado_em=CURRENT_TIMESTAMP WHERE id=$6 RETURNING *`,
      [customerId, subscriptionId, config.valorCentavos, dataFutura(config.trialDias), pagamento.billingType, assinatura.id],
    )).rows[0];
    await db.query('COMMIT');
    return assinatura;
  } catch (erro) {
    await db.query('ROLLBACK');
    throw erro;
  } finally {
    db.release();
  }
}

function validarTokenWebhook(req, config = configurarAsaas()) {
  if (!config.webhookToken) throw erroHttp(503, 'Token do webhook do Asaas não configurado.');
  const recebido = req.get('asaas-access-token') || req.get('access_token') || req.get('authorization')?.replace(/^Bearer\s+/i, '') || req.query.token;
  if (recebido !== config.webhookToken) throw erroHttp(401, 'Webhook do Asaas não autorizado.');
}

function resumoAssinatura(assinatura) {
  const hoje = Date.now();
  const trialFim = assinatura.trial_fim_em ? new Date(assinatura.trial_fim_em).getTime() : hoje;
  const diasTrial = Math.max(0, Math.ceil((trialFim - hoje) / 86400000));
  return {
    ...assinatura,
    valor_reais: centavosParaReais(assinatura.valor_centavos),
    dias_trial_restantes: diasTrial,
    em_trial: assinatura.status === 'trial' && diasTrial > 0,
  };
}

async function processarEventoAsaas(banco, payload) {
  const evento = String(payload.event || '');
  const payment = payload.payment || {};
  const subscriptionId = payment.subscription || payload.subscription?.id || payload.subscription;
  const paymentId = payment.id;
  const db = await banco.connect();
  try {
    await db.query('BEGIN');
    await db.query(
      `INSERT INTO eventos_asaas (evento_id,evento,asaas_payment_id,asaas_subscription_id,payload)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [payload.id || null, evento, paymentId || null, subscriptionId || null, JSON.stringify(payload)],
    );
    if (subscriptionId) {
      const assinatura = (await db.query('SELECT * FROM assinaturas WHERE asaas_subscription_id=$1 FOR UPDATE', [subscriptionId])).rows[0];
      if (assinatura) {
        const novoStatus = statusPago.has(evento) ? 'ativo' : statusProblema.has(evento) ? 'pendente' : assinatura.status;
        await db.query(
          `UPDATE assinaturas SET status=$1,ultimo_evento=$2,proxima_cobranca_em=COALESCE($3,proxima_cobranca_em),billing_type=COALESCE($4,billing_type),atualizado_em=CURRENT_TIMESTAMP WHERE id=$5`,
          [novoStatus, evento, payment.dueDate || null, payment.billingType || null, assinatura.id],
        );
        if (paymentId) {
          await db.query(
            `INSERT INTO pagamentos (assinatura_id,marcenaria_id,asaas_payment_id,status,valor_centavos,vencimento_em,confirmado_em,invoice_url)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (asaas_payment_id) DO UPDATE SET status=EXCLUDED.status,valor_centavos=EXCLUDED.valor_centavos,
             vencimento_em=EXCLUDED.vencimento_em,confirmado_em=EXCLUDED.confirmado_em,invoice_url=EXCLUDED.invoice_url,atualizado_em=CURRENT_TIMESTAMP`,
            [assinatura.id, assinatura.marcenaria_id, paymentId, evento, Math.round(Number(payment.value || 0) * 100), payment.dueDate || null, statusPago.has(evento) ? new Date() : null, payment.invoiceUrl || null],
          );
        }
      }
    }
    await db.query('COMMIT');
  } catch (erro) {
    await db.query('ROLLBACK');
    throw erro;
  } finally {
    db.release();
  }
}

function registrarWebhookAsaas(app, banco, rota) {
  app.post('/api/webhooks/asaas', rota(async (req, res) => {
    validarTokenWebhook(req);
    await processarEventoAsaas(banco, req.body || {});
    res.json({ recebido: true });
  }));
}

function registrarAssinaturasAsaas(app, banco, rota) {
  app.get('/api/assinatura', rota(async (req, res) => {
    const assinatura = await assinaturaAtual(banco, req.marcenaria.id);
    const documentoObrigatorio = !(await banco.query('SELECT documento FROM usuarios WHERE id=$1', [req.usuario.id])).rows[0]?.documento;
    res.json({ assinatura: resumoAssinatura(assinatura), configurado: Boolean(configurarAsaas().apiKey), documento_obrigatorio: documentoObrigatorio });
  }));

  app.post('/api/assinatura/iniciar', rota(async (req, res) => {
    if (!['proprietario', 'administrador', 'superadministrador'].includes(req.marcenaria.papel)) throw erroHttp(403, 'Somente administradores podem iniciar a assinatura.');
    const assinatura = await iniciarAssinatura(banco, req.usuario, req.marcenaria, { ...req.body, remoteIp: req.ip });
    res.json({ assinatura: resumoAssinatura(assinatura) });
  }));
}

module.exports = { configurarAsaas, iniciarAssinatura, processarEventoAsaas, resumoAssinatura, registrarWebhookAsaas, registrarAssinaturasAsaas, validarDocumentoCobranca, validarFormaPagamento };
