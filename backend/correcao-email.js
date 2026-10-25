/** Corrige somente cadastros não confirmados, mediante documento e senha. */
const crypto = require('node:crypto');
const { emailValido } = require('./seguranca');
const { erroHttp } = require('./projetos');
const { enviarEmail } = require('./email');
function registrarCorrecaoEmail(app, banco, rota, { validarDocumento, conferirSenha }) {
  const tentativas = new Map();
  function limitarTentativas(req, res, next) {
    const agora = Date.now(), ip = req.ip || req.socket.remoteAddress;
    for (const [chave, valor] of tentativas) if (valor.expira <= agora) tentativas.delete(chave);
    let registro = tentativas.get(ip);
    if (!registro) {
      if (tentativas.size >= 10000) return res.status(429).json({ mensagem: 'Tente novamente mais tarde.' });
      registro = { total: 0, expira: agora + 15 * 60 * 1000 }; tentativas.set(ip, registro);
    }
    if (++registro.total > 10) {
      res.set('Retry-After', String(Math.ceil((registro.expira - agora) / 1000)));
      return res.status(429).json({ mensagem: 'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.' });
    }
    next();
  }
  app.post('/api/auth/corrigir-email', limitarTentativas, rota(async (req, res) => {
    const documento = validarDocumento(req.body?.documento), senha = req.body?.senha;
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const repetido = typeof req.body?.email_confirmacao === 'string' ? req.body.email_confirmacao.trim().toLowerCase() : '';
    if (!emailValido(email) || email !== repetido) throw erroHttp(400, 'Digite e confirme o novo e-mail corretamente.');
    if (typeof senha !== 'string' || !senha || senha.length > 200) throw erroHttp(400, 'Informe a senha cadastrada.');
    const db = await banco.connect();
    try {
      await db.query('BEGIN');
      const usuario = (await db.query('SELECT id,nome,email,senha_hash,email_confirmado,superadministrador FROM usuarios WHERE documento=$1 AND ativo=TRUE FOR UPDATE', [documento])).rows[0];
      if (!usuario || !(await conferirSenha(senha, usuario.senha_hash)) || usuario.email_confirmado || usuario.superadministrador) throw erroHttp(403, 'Não foi possível corrigir o e-mail. Confira os dados; esta opção é exclusiva para cadastros ainda não confirmados.');
      const recente = (await db.query("SELECT 1 FROM tokens_usuario WHERE usuario_id=$1 AND tipo='confirmar_email' AND usado_em IS NOT NULL AND criado_em>NOW()-INTERVAL '1 minute' LIMIT 1", [usuario.id])).rows.length;
      if (recente) throw erroHttp(429, 'Aguarde um minuto antes de corrigir novamente.');
      await db.query('UPDATE usuarios SET email=$1 WHERE id=$2', [email, usuario.id]);
      await db.query('UPDATE tokens_usuario SET usado_em=NOW() WHERE usuario_id=$1 AND usado_em IS NULL', [usuario.id]);
      await db.query('DELETE FROM sessoes WHERE usuario_id=$1', [usuario.id]);
      await db.query("DELETE FROM emails_saida WHERE lower(destinatario)=lower($1) AND status IN ('simulado','pendente','falhou')", [usuario.email]);
      const token = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      await db.query("INSERT INTO tokens_usuario(token_hash,usuario_id,tipo,expira_em) VALUES ($1,$2,'confirmar_email',NOW()+INTERVAL '24 hours')", [hash, usuario.id]);
      const link = `${(process.env.FRONTEND_URL || 'http://localhost:5176').replace(/\/$/, '')}/?confirmar=${token}`;
      await enviarEmail(db, { destinatario: email, assunto: 'Confirme seu cadastro na Norden', texto: `Olá, ${usuario.nome}. Confirme seu cadastro acessando: ${link}` });
      await db.query('COMMIT');
      res.json({ mensagem: 'E-mail corrigido. Confira a nova caixa de entrada para ativar sua conta. Seu CPF/CNPJ e sua empresa foram preservados.' });
    } catch (erro) {
      await db.query('ROLLBACK');
      if (erro.code === '23505') throw erroHttp(409, 'Não foi possível usar este e-mail. Escolha outro endereço.');
      throw erro;
    } finally { db.release(); }
  }));
}
module.exports = { registrarCorrecaoEmail };
