/**
 * Ferramenta administrativa executada manualmente: cria ou atualiza o usuário com acesso a todas as empresas. Leia ADMINISTRACAO.md antes de executar; repetir o comando troca a senha do usuário correspondente.
 */
const pool = require('./database');
const { criarHashSenha } = require('./auth');

async function main() {
  // DEFINA O ACESSO em backend/.env (privado), nunca neste arquivo:
  // ADMIN_USUARIO = nome usado no campo "Usuário ou e-mail".
  // ADMIN_SENHA = senha escolhida, sem reutilizar DB_PASSWORD (senha do banco).
  // Apenas definir essas variáveis não cria a conta: este script precisa ser executado.
  const usuario = process.env.ADMIN_USUARIO?.trim();
  const senha = process.env.ADMIN_SENHA;
  if (!usuario || !senha) throw new Error('Defina ADMIN_USUARIO e ADMIN_SENHA.');
  const hash = await criarHashSenha(senha);
  // Procura pelo usuário, não pelo e-mail. Se existir, a senha dele será substituída.
  const existente = (await pool.query('SELECT id FROM usuarios WHERE lower(usuario)=lower($1)', [usuario])).rows[0];
  if (existente) {
    await pool.query(`UPDATE usuarios SET senha_hash=$1,superadministrador=TRUE,trocar_senha=TRUE,ativo=TRUE WHERE id=$2`, [hash,existente.id]);
  } else {
    // ATENÇÃO: este caminho usa e-mail interno e não marca email_confirmado.
    // O login atual exige confirmação; revisar esse fluxo antes de provisionar uma conta nova.
    await pool.query(`INSERT INTO usuarios (nome,email,usuario,senha_hash,superadministrador,trocar_senha)
      VALUES ('Administrador', $1, $2, $3, TRUE, TRUE)`, [`${usuario.toLowerCase()}@local.invalid`,usuario,hash]);
  }
  // trocar_senha bloqueia o login em produção; não significa que exista uma tela de troca aqui.
  console.log(`Administrador universal "${usuario}" provisionado com troca de senha pendente.`);
}
main().catch(erro => { console.error(erro.message); process.exitCode=1; }).finally(() => pool.end());
