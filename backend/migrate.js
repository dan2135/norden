/**
 * Aplica os arquivos SQL na ordem necessária para criar e atualizar a estrutura do banco selecionado. Não é uma cópia dos dados de outro banco.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { diagnosticarBanco } = require('./diagnostico-banco');
let pool;

async function main() {
  pool = require('./database');
  console.log('[BANCO] Iniciando preparação:', process.env.NORDEN_DEMO === 'true' ? 'demonstração' : 'principal');
  const db = await pool.connect();
  try {
    await db.query(await fs.readFile(path.join(__dirname, 'migrations/000-estrutura-inicial.sql'), 'utf8'));
    await db.query(await fs.readFile(path.join(__dirname, 'migrations/001-multiplos-projetos.sql'), 'utf8'));
    await db.query(await fs.readFile(path.join(__dirname, 'migrations/002-estado-coleta.sql'), 'utf8'));
    await db.query(await fs.readFile(path.join(__dirname, 'migrations/003-orcamentos.sql'), 'utf8'));
    await db.query(await fs.readFile(path.join(__dirname, 'migrations/004-catalogo-materiais.sql'), 'utf8'));
    await db.query(await fs.readFile(path.join(__dirname, 'migrations/005-multiempresa.sql'), 'utf8'));
    await db.query(await fs.readFile(path.join(__dirname, 'migrations/006-autenticacao.sql'), 'utf8'));
    await db.query(await fs.readFile(path.join(__dirname, 'migrations/007-superadministrador.sql'), 'utf8'));
    await db.query(await fs.readFile(path.join(__dirname, 'migrations/008-cadastro-recuperacao.sql'), 'utf8'));
    await db.query(await fs.readFile(path.join(__dirname, 'migrations/009-lixeira-clientes.sql'), 'utf8'));
    await db.query(await fs.readFile(path.join(__dirname, 'migrations/010-lixeira-projetos.sql'), 'utf8'));
    await db.query(await fs.readFile(path.join(__dirname, 'migrations/011-segmentos.sql'), 'utf8'));
    await db.query(await fs.readFile(path.join(__dirname, 'migrations/012-email-smtp.sql'), 'utf8'));
    const resultado = await db.query('SELECT COUNT(*) AS total FROM mensagens WHERE projeto_id IS NULL');
    console.log('Migração concluída. Mensagens antigas sem vínculo:', resultado.rows[0].total);
  } catch (erro) {
    await db.query('ROLLBACK').catch(() => {});
    throw erro;
  } finally { db.release(); }
}
main().catch(erro => { console.error(diagnosticarBanco(erro)); process.exitCode = 1; }).finally(() => pool?.end());
