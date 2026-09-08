const api = import.meta.env?.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000/api`;
let marcenariaId = null;
let csrfToken = null;

export function definirMarcenaria(id) { marcenariaId = id ? String(id) : null; }
export function definirCsrf(token) { csrfToken = token || null; }

export async function requisicao(caminho, opcoes = {}) {
  let resposta;
  try {
    const headers = new Headers(opcoes.headers || {});
    if (marcenariaId && !caminho.startsWith('/auth/')) headers.set('X-Marcenaria-ID', marcenariaId);
    const metodo = (opcoes.method || 'GET').toUpperCase();
    if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(metodo)) headers.set('X-CSRF-Token', csrfToken);
    resposta = await fetch(api + caminho, { ...opcoes, headers, credentials: 'include', signal: AbortSignal.timeout(45000) });
  } catch (erro) {
    if (erro.name === 'TimeoutError') throw new Error('O atendimento demorou demais. Recarregue o histórico antes de reenviar para conferir se a mensagem foi salva.', { cause: erro });
    throw new Error('Não foi possível conectar ao backend. Verifique o terminal do servidor e tente novamente.', { cause: erro });
  }
  if (!resposta.headers.get('content-type')?.includes('application/json')) {
    throw new Error('O backend respondeu em um formato inesperado. Reinicie o backend atualizado com npm.cmd start.');
  }
  let dados;
  try { dados = await resposta.json(); }
  catch (erro) { throw new Error('O backend retornou dados inválidos. Confira o terminal do servidor.', { cause: erro }); }
  if (!resposta.ok) {
    const erro = new Error(dados.mensagem || 'Não foi possível carregar o atendimento.');
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}
