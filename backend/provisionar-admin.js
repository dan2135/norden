/** Execute manualmente após preencher ADMIN_USUARIO, ADMIN_EMAIL e ADMIN_SENHA no .env privado. */
const pool = require('./database');
const { provisionarAdmin } = require('./admin');
provisionarAdmin(pool).then(() => console.log('Administrador preparado. Entre e troque a senha temporária.'))
  .catch(erro => { console.error(erro.code ? 'Falha no banco ao provisionar; confira possíveis conflitos de cadastro.' : erro.message); process.exitCode=1; })
  .finally(() => pool.end());
