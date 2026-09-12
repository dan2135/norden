/**
 * Cria o conjunto de conexões PostgreSQL compartilhado pelas rotas. DB_TARGET escolhe a configuração local ou o arquivo privado do Supabase; SSL valida o certificado remoto.
 */
const { Pool } = require("pg");
const fs = require('node:fs');
const path = require('node:path');
require("dotenv").config({ path: require('node:path').join(__dirname, '.env'), quiet: true });

// O arquivo separado permite voltar ao banco local sem perder sua configuração.
const config = process.env.NORDEN_DEMO === 'true'
  ? require('./banco-demo').configuracaoBancoDemo(process.env)
  : process.env.DB_TARGET === 'supabase' && process.env.NODE_ENV !== 'production'
  ? require('dotenv').parse(fs.readFileSync(path.join(__dirname, '.env.supabase')))
  : process.env;

// Conexões na nuvem validam o certificado; o banco local continua sem SSL.
if (process.env.NODE_ENV === 'production') {
  const faltantes = ['DB_HOST','DB_PORT','DB_DATABASE','DB_USER','DB_PASSWORD'].filter(chave => !config[chave]?.trim());
  if (faltantes.length) {
    const erro = new Error('Configuração do banco incompleta em produção.');
    erro.code = 'DB_CONFIG_AUSENTE';
    throw erro;
  }
}
const usarSsl = config.DB_SSL === 'true';
const certificado = config.DB_SSL_CA_FILE;

const pool = new Pool({
  user: config.DB_USER,
  host: config.DB_HOST,
  database: config.DB_DATABASE,
  password: config.DB_PASSWORD,
  port: config.DB_PORT,
  ssl: usarSsl ? {
    rejectUnauthorized: true,
    ...(certificado ? { ca: fs.readFileSync(path.resolve(__dirname, certificado), 'utf8') } : {}),
  } : false,
  connectionTimeoutMillis: 5000,
});

module.exports = pool;
