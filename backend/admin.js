/** Provisionamento manual: o operador atesta o e-mail; nunca expor como rota pública. */
const { criarHashSenha } = require('./auth');
const { emailValido } = require('./seguranca');
async function provisionarAdmin(banco, env = process.env) {
  const usuario = env.ADMIN_USUARIO?.trim(), senha = env.ADMIN_SENHA, email = env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(usuario || '')) throw new Error('ADMIN_USUARIO deve ter 3 a 80 caracteres: letras, números, ponto, hífen ou sublinhado.');
  if (typeof senha !== 'string' || senha.length < 10 || senha.length > 200) throw new Error('ADMIN_SENHA deve ter entre 10 e 200 caracteres.');
  if (!emailValido(email) || email.endsWith('.invalid')) throw new Error('Defina ADMIN_EMAIL com seu e-mail real.');
  const hash = await criarHashSenha(senha), db = await banco.connect();
  try {
    await db.query('BEGIN');
    await db.query('LOCK TABLE usuarios IN EXCLUSIVE MODE');
    const existente = (await db.query('SELECT id,superadministrador FROM usuarios WHERE lower(usuario)=lower($1)', [usuario])).rows[0];
    if (existente && !existente.superadministrador) throw new Error('Este usuário pertence a uma conta comum; promoção automática não permitida.');
    if (existente && env.ADMIN_REDEFINIR !== 'true') throw new Error('Administrador já existe. Para substituir a senha, defina ADMIN_REDEFINIR=true explicitamente.');
    let id;
    if (existente) {
      id = existente.id;
      await db.query('UPDATE usuarios SET email=$1,senha_hash=$2,email_confirmado=TRUE,trocar_senha=TRUE,ativo=TRUE WHERE id=$3', [email,hash,id]);
    } else {
      id = (await db.query(`INSERT INTO usuarios (nome,email,usuario,senha_hash,superadministrador,trocar_senha,email_confirmado)
        VALUES ('Administrador',$1,$2,$3,TRUE,TRUE,TRUE) RETURNING id`, [email,usuario,hash])).rows[0].id;
    }
    await db.query('DELETE FROM sessoes WHERE usuario_id=$1', [id]);
    await db.query('UPDATE tokens_usuario SET usado_em=CURRENT_TIMESTAMP WHERE usuario_id=$1 AND usado_em IS NULL', [id]);
    await db.query('COMMIT');
  } catch (erro) { await db.query('ROLLBACK'); throw erro; } finally { db.release(); }
}
module.exports = { provisionarAdmin };
