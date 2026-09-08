const pool = require('./database');
const { criarHashSenha } = require('./auth');

async function main() {
  const usuario = process.env.ADMIN_USUARIO?.trim();
  const senha = process.env.ADMIN_SENHA;
  if (!usuario || !senha) throw new Error('Defina ADMIN_USUARIO e ADMIN_SENHA.');
  const hash = await criarHashSenha(senha);
  const existente = (await pool.query('SELECT id FROM usuarios WHERE lower(usuario)=lower($1)', [usuario])).rows[0];
  if (existente) {
    await pool.query(`UPDATE usuarios SET senha_hash=$1,superadministrador=TRUE,trocar_senha=TRUE,ativo=TRUE WHERE id=$2`, [hash,existente.id]);
  } else {
    await pool.query(`INSERT INTO usuarios (nome,email,usuario,senha_hash,superadministrador,trocar_senha)
      VALUES ('Administrador', $1, $2, $3, TRUE, TRUE)`, [`${usuario.toLowerCase()}@local.invalid`,usuario,hash]);
  }
  console.log(`Administrador universal "${usuario}" provisionado com troca de senha pendente.`);
}
main().catch(erro => { console.error(erro.message); process.exitCode=1; }).finally(() => pool.end());
