/** Preferências opcionais só são salvas depois de uma escolha explícita no aviso de cookies. */
const chaveConsentimento = 'norden:preferencias-cookie';
const chavesOpcionais = ['norden-landing-theme', 'marceneiro-ia:marcenaria'];

export function lerConsentimentoCookies() {
  try { return localStorage.getItem(chaveConsentimento); } catch { return null; }
}

export function preferenciasAutorizadas() { return lerConsentimentoCookies() === 'aceitas'; }

export function registrarConsentimentoCookies(aceitar) {
  try {
    localStorage.setItem(chaveConsentimento, aceitar ? 'aceitas' : 'essenciais');
    if (!aceitar) chavesOpcionais.forEach(chave => localStorage.removeItem(chave));
  } catch { /* O site continua funcionando mesmo sem armazenamento local. */ }
}

export function lerPreferencia(chave) {
  if (!preferenciasAutorizadas()) return null;
  try { return localStorage.getItem(chave); } catch { return null; }
}

export function salvarPreferencia(chave, valor) {
  if (!preferenciasAutorizadas()) return;
  try { localStorage.setItem(chave, valor); } catch { /* Preferência fica apenas nesta visita. */ }
}

export function revisarConsentimentoCookies() {
  try {
    localStorage.removeItem(chaveConsentimento);
    chavesOpcionais.forEach(chave => localStorage.removeItem(chave));
  } catch { /* A revisão poderá ser feita novamente na próxima visita. */ }
}
