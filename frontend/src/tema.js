/**
 * Preferência compartilhada de tema: sincroniza claro/escuro entre telas e abas. Armazena somente essa preferência local, não credenciais.
 */
import { useSyncExternalStore } from 'react';
const chave = 'norden-landing-theme';
const sistema = window.matchMedia('(prefers-color-scheme: dark)');
const ouvintes = new Set();
let escolha;
try { escolha = localStorage.getItem(chave); } catch { /* Preferência apenas nesta visita. */ }
const atual = () => escolha === 'dark' || (escolha !== 'light' && sistema.matches);
function atualizar() {
  document.documentElement.dataset.theme = atual() ? 'dark' : 'light';
  ouvintes.forEach(ouvinte => ouvinte());
}
atualizar();
sistema.addEventListener('change', atualizar);
window.addEventListener('storage', evento => {
  if (evento.key === chave || evento.key === null) { escolha = evento.newValue; atualizar(); }
});
function assinar(ouvinte) { ouvintes.add(ouvinte); return () => ouvintes.delete(ouvinte); }
export function useTema() {
  const escuro = useSyncExternalStore(assinar, atual);
  return [escuro, () => {
    escolha = atual() ? 'light' : 'dark';
    try { localStorage.setItem(chave, escolha); } catch { /* Continua sem armazenamento. */ }
    atualizar();
  }];
}
