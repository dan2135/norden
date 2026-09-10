/**
 * Valida SMTP e administra a fila de e-mails. O envio ocorre após a gravação no banco, com tentativas limitadas e remoção do conteúdo após envio ou expiração.
 */
const { emailValido } = require('./seguranca');
// Escolhe modo simulado ou SMTP e valida os parâmetros antes de permitir envio real.
function configuracaoEmail(env = process.env) {
  const modo = env.EMAIL_MODE || (env.NODE_ENV === 'production' ? 'smtp' : 'simulado');
  if (!['smtp', 'brevo', 'simulado'].includes(modo)) throw new Error('EMAIL_MODE deve ser smtp, brevo ou simulado.');
  if (modo === 'simulado') {
    if (env.NODE_ENV === 'production') throw new Error('E-mail simulado não é permitido em produção.');
    return { modo };
  }
  const obrigatorias = modo === 'brevo' ? ['BREVO_API_KEY','EMAIL_FROM','FRONTEND_URL'] : ['SMTP_HOST','SMTP_USER','SMTP_PASS','EMAIL_FROM','FRONTEND_URL'];
  for (const chave of obrigatorias) {
    if (!env[chave]?.trim()) throw new Error(`Configure ${chave} para ativar os e-mails.`);
  }
  if (!emailValido(env.EMAIL_FROM)) throw new Error('EMAIL_FROM deve conter apenas o endereço de e-mail.');
  const url = new URL(env.FRONTEND_URL);
  if (!['http:','https:'].includes(url.protocol) || (env.NODE_ENV === 'production' && (url.protocol !== 'https:' || ['localhost','127.0.0.1','[::1]'].includes(url.hostname)))) throw new Error('Configure a URL pública HTTPS do painel.');
  if (modo === 'brevo') return { modo, from: env.EMAIL_FROM, apiKey: env.BREVO_API_KEY.trim() };
  const port = Number(env.SMTP_PORT || 587);
  if (![465,587].includes(port)) throw new Error('Use SMTP_PORT 465 ou 587 com TLS.');
  return { modo, from:env.EMAIL_FROM, transporte: {
    host:env.SMTP_HOST, port, secure:port===465, requireTLS:true,
    auth:{user:env.SMTP_USER,pass:env.SMTP_PASS},
    connectionTimeout:10000, greetingTimeout:10000, socketTimeout:30000,
    disableFileAccess:true, disableUrlAccess:true,
  }};
}

// Insere a mensagem na fila; não envia diretamente durante a transação do cadastro.
async function enviarEmail(banco, { destinatario, assunto, texto }, env = process.env) {
  const { modo } = configuracaoEmail(env);
  // O worker só vê mensagens após o COMMIT do cadastro.
  await banco.query('INSERT INTO emails_saida (destinatario,assunto,texto,status) VALUES ($1,$2,$3,$4)',
    [destinatario,assunto,texto,modo === 'simulado' ? 'simulado' : 'pendente']);
  // Não registrar tokens, destinatários ou credenciais no terminal.
  return { simulado:modo === 'simulado', enfileirado:modo !== 'simulado' };
}

// Reserva uma mensagem elegível, tenta entregá-la e atualiza tentativas e situação.
async function processarEmail(banco, transporte, from) {
  const resultado = await banco.query(`UPDATE emails_saida SET status='enviando',
    tentativas=tentativas+1, proxima_tentativa_em=NOW()+INTERVAL '5 minutes'
    WHERE id=(SELECT id FROM emails_saida WHERE status IN ('pendente','enviando')
      AND tentativas<5 AND proxima_tentativa_em<=NOW()
      AND criado_em>NOW()-INTERVAL '45 minutes'
      ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`);
  const email = resultado.rows[0];
  if (!email) return false;
  try {
    const info = await transporte.sendMail({from:{name:'Norden',address:from},to:email.destinatario,subject:email.assunto,text:email.texto});
    if (!info.accepted?.length) throw new Error('Destinatário não aceito');
    await banco.query("UPDATE emails_saida SET status='enviado',enviado_em=NOW(),texto='[conteúdo removido após envio]' WHERE id=$1",[email.id]);
  } catch {
    await banco.query("UPDATE emails_saida SET status=CASE WHEN tentativas>=5 THEN 'falhou' ELSE 'pendente' END,proxima_tentativa_em=NOW()+INTERVAL '1 minute' WHERE id=$1",[email.id]);
  }
  return true;
}

// Inicia o processamento periódico e devolve uma função para encerrá-lo.
function iniciarEmails(banco, env = process.env) {
  const config = configuracaoEmail(env);
  if(config.modo === 'simulado') return ()=>{};
  const transporte = config.modo === 'brevo'
    ? require('./email-brevo').criarTransporteBrevo(config.apiKey)
    : require('nodemailer').createTransport(config.transporte);
  let ocupado=false;
  async function executar() {
    if(ocupado) return;
    ocupado=true;
    try {
      await banco.query("UPDATE emails_saida SET status='falhou',texto='[conteúdo expirado removido]' WHERE status IN ('pendente','enviando') AND (criado_em<=NOW()-INTERVAL '45 minutes' OR (tentativas>=5 AND proxima_tentativa_em<=NOW()))");
      await processarEmail(banco,transporte,config.from);
    } catch { console.error('[EMAIL] Falha ao processar a fila. Verifique a conexão com o banco.'); }
    finally { ocupado=false; }
  }
  const timer=setInterval(executar,5000); timer.unref();
  void executar();
  return ()=>{clearInterval(timer);transporte.close();};
}
module.exports = { enviarEmail, configuracaoEmail, processarEmail, iniciarEmails };
