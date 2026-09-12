/** Resume falhas sem imprimir mensagens SQL, credenciais ou conteúdo de registros. */
function diagnosticarBanco(erro) {
  const codigos = new Set();
  function visitar(item, nivel = 0) {
    if (!item || nivel > 4) return;
    if (/^[A-Z0-9_]{2,50}$/.test(String(item.code || ''))) codigos.add(item.code);
    if (Array.isArray(item.errors)) item.errors.slice(0, 10).forEach(e => visitar(e, nivel + 1));
    visitar(item.cause, nivel + 1);
  }
  visitar(erro);
  const orientacoes = {
    DB_CONFIG_AUSENTE: 'Faltam variáveis do banco. Na demonstração, confira NORDEN_DEMO=true e todos os campos DEMO_DB_* no Render.',
    ECONNREFUSED: 'O endereço/porta recusou a conexão. Confira as variáveis do banco e NORDEN_DEMO=true; sem configuração o cliente pode tentar localhost.',
    ENOTFOUND: 'Não foi possível localizar o servidor. Confira DEMO_DB_HOST.',
    EAI_AGAIN: 'Falha temporária ao localizar o servidor do banco.',
    ETIMEDOUT: 'A conexão excedeu o prazo. Confira endereço, porta e disponibilidade do banco.',
    ENETUNREACH: 'Rede indisponível. Confira se está usando o Session pooler.',
    '28P01': 'O banco recusou usuário ou senha. Confira DEMO_DB_USER e DEMO_DB_PASSWORD.',
    SELF_SIGNED_CERT_IN_CHAIN: 'Certificado não reconhecido. Configure DEMO_DB_SSL_CA_FILE com o certificado correto do Supabase.',
    DEPTH_ZERO_SELF_SIGNED_CERT: 'Certificado não reconhecido. Configure o certificado correto do Supabase.',
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'Não foi possível validar o certificado do banco. Confira o arquivo CA.',
    ENOENT: 'Arquivo de configuração ou certificado não encontrado. Confira os caminhos configurados.',
    '42501': 'O usuário do banco não tem permissão para executar a migração.',
  };
  const dicas = [...codigos].map(codigo => orientacoes[codigo]).filter(Boolean);
  return `[BANCO] Falha na preparação. Códigos: ${[...codigos].join(', ') || 'não informado'}. ${[...new Set(dicas)].join(' ') || 'Confira a configuração do banco e as migrações; detalhes privados foram omitidos.'}`;
}
module.exports = { diagnosticarBanco };
