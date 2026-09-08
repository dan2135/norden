const { Pool } = require("pg");
require("dotenv").config({ path: require('node:path').join(__dirname, '.env'), quiet: true });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  connectionTimeoutMillis: 5000,
});

module.exports = pool;
