/** Configuração de rede local e em nuvem. Aceita apenas origens explicitamente configuradas. */
function configuracaoHospedagem(env = process.env) {
  const producao = env.NODE_ENV === 'production';
  const porta = Number(env.PORT || 3000);
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) throw new Error('PORT inválida.');
  const urlPublica = env.FRONTEND_URL || env.RENDER_EXTERNAL_URL;
  if (producao && !urlPublica) throw new Error('Configure FRONTEND_URL com o endereço público HTTPS.');
  const locais = [5173,5174,5175,5176].flatMap(porta => [`http://localhost:${porta}`, `http://127.0.0.1:${porta}`]);
  const origens = (env.FRONTEND_ORIGIN || (producao ? urlPublica : locais.join(','))).split(',').map(valor => valor.trim());
  for (const origem of [...origens, ...(urlPublica ? [urlPublica] : [])]) {
    const url = new URL(origem);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origem || (producao && url.protocol !== 'https:')) {
      throw new Error('Use endereços completos de origem, sem caminho ou barra final; HTTPS em produção.');
    }
  }
  return { porta, host: env.HOST || (producao ? '0.0.0.0' : '127.0.0.1'), origens };
}
module.exports = { configuracaoHospedagem };
