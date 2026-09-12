/** Configuração própria da demonstração: nunca herda silenciosamente o banco principal. */
function configuracaoBancoDemo(env) {
  const config = {};
  for (const campo of ['HOST', 'PORT', 'DATABASE', 'USER', 'PASSWORD']) {
    const chave = `DEMO_DB_${campo}`;
    if (!env[chave]?.trim()) {
      const erro = new Error(`Configure ${chave} com o banco exclusivo da demonstração.`);
      erro.code = 'DB_CONFIG_AUSENTE';
      throw erro;
    }
    config[`DB_${campo}`] = env[chave];
  }
  if (config.DB_HOST === env.DB_HOST && config.DB_DATABASE === env.DB_DATABASE && config.DB_USER === env.DB_USER) {
    throw new Error('A demonstração precisa de um banco separado do principal.');
  }
  config.DB_SSL = 'true';
  config.DB_SSL_CA_FILE = env.DEMO_DB_SSL_CA_FILE;
  return config;
}
module.exports = { configuracaoBancoDemo };
