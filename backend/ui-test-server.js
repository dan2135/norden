// Servidor isolado para QA da interface. Tudo é revertido ao encerrar.
const pool = require('./database');
const { criarApp } = require('./server');

async function main() {
  const db = await pool.connect();
  await db.query('BEGIN');
  const banco = {
    query: (...args) => db.query(...args),
    connect: async () => ({
      query: (sql, params) => db.query(({ BEGIN: 'SAVEPOINT ui', COMMIT: 'RELEASE SAVEPOINT ui', ROLLBACK: 'ROLLBACK TO SAVEPOINT ui' })[sql] || sql, params),
      release() {},
    }),
  };
  const server = criarApp({ banco }).listen(3001, '127.0.0.1', () => console.log('QA isolado em http://127.0.0.1:3001 — registros serão revertidos'));
  const encerrar = async () => {
    server.close();
    await db.query('ROLLBACK');
    db.release();
    await pool.end();
    process.exit(0);
  };
  process.once('SIGINT', encerrar);
  process.once('SIGTERM', encerrar);
  server.once('error', async erro => { console.error(erro.message); await encerrar(); });
}
main().catch(erro => { console.error(erro); process.exitCode = 1; pool.end(); });
