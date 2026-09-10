/**
 * Solicita outro link de confirmação com limite de frequência, sem informar publicamente se um endereço está cadastrado.
 */
const crypto = require('node:crypto');
const { emailValido } = require('./seguranca');
const { erroHttp } = require('./projetos');
const { enviarEmail } = require('./email');

// Emite outro token com controle de frequência e enfileira o e-mail sem revelar a existência da conta.
async function reenviarConfirmacao(banco, email, enviar = enviarEmail) {
  if (typeof email !== 'string' || !emailValido(email.trim())) throw erroHttp(400,'Informe um e-mail válido.');
  const db = await banco.connect();
  try {
    await db.query('BEGIN');
    const usuario=(await db.query('SELECT id,nome,email,email_confirmado FROM usuarios WHERE lower(email)=$1 AND ativo=TRUE FOR UPDATE',[email.trim().toLowerCase()])).rows[0];
    if(usuario && !usuario.email_confirmado) {
      // Lock do usuário serializa reenvios simultâneos; resposta pública não revela cadastro.
      const recente=(await db.query("SELECT 1 FROM tokens_usuario WHERE usuario_id=$1 AND tipo='confirmar_email' AND criado_em>NOW()-INTERVAL '1 minute' LIMIT 1",[usuario.id])).rows.length;
      if(!recente) {
        const token=crypto.randomBytes(32).toString('hex');
        const hash=crypto.createHash('sha256').update(token).digest('hex');
        const link=`${(process.env.FRONTEND_URL || 'http://localhost:5176').replace(/\/$/,'')}/?confirmar=${token}`;
        // Links anteriores permanecem válidos até expirar: reenvio não deve inutilizar uma mensagem em trânsito.
        await db.query("INSERT INTO tokens_usuario(token_hash,usuario_id,tipo,expira_em) VALUES ($1,$2,'confirmar_email',NOW()+INTERVAL '24 hours')",[hash,usuario.id]);
        await enviar(db,{destinatario:usuario.email,assunto:'Confirme seu cadastro na Norden',texto:`Olá, ${usuario.nome}. Confirme seu cadastro acessando: ${link}`});
      }
    }
    await db.query('COMMIT');
    return {mensagem:'Se houver um cadastro aguardando confirmação, enviaremos um novo link. Confira também o spam. Aguarde um minuto antes de solicitar novamente.'};
  } catch(erro) {await db.query('ROLLBACK');throw erro;} finally {db.release();}
}
module.exports={reenviarConfirmacao};
