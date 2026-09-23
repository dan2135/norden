/**
 * Preferência compartilhada de tema: sincroniza claro/escuro entre telas e abas. Armazena somente essa preferência local, não credenciais.
 */
import { useSyncExternalStore } from 'react';
import { lerPreferencia, salvarPreferencia } from './privacidade';
const chave = 'norden-landing-theme';
const sistema = window.matchMedia('(prefers-color-scheme: dark)');
const ouvintes = new Set();
let escolha;
escolha = lerPreferencia(chave);
const atual = () => escolha === 'dark' || (escolha !== 'light' && sistema.matches);
function atualizar() {
  document.documentElement.dataset.theme = atual() ? 'dark' : 'light';
  ouvintes.forEach(ouvinte => ouvinte());
}
atualizar();
sistema.addEventListener('change', atualizar);
window.addEventListener('storage', evento => {
  if (evento.key === chave || evento.key === null) { escolha = lerPreferencia(chave); atualizar(); }
});
function assinar(ouvinte) { ouvintes.add(ouvinte); return () => ouvintes.delete(ouvinte); }
export function useTema() {
  const escuro = useSyncExternalStore(assinar, atual);
  return [escuro, () => {
    escolha = atual() ? 'light' : 'dark';
    salvarPreferencia(chave, escolha);
    atualizar();
  }];
}
