/**
 * Botão acessível que alterna a preferência compartilhada de tema. A variante flutuante aparece nas telas internas.
 */
import { useTema } from './tema';
export default function BotaoTema({ flutuante = false }) {
  const [escuro, alternar] = useTema();
  return <button type="button" className={`tema-botao${flutuante ? ' tema-flutuante' : ''}`} onClick={alternar}
    aria-label="Modo escuro" aria-pressed={escuro} title={escuro ? 'Ativar modo claro' : 'Ativar modo escuro'}>
    <span aria-hidden="true">{escuro ? '☀' : '☾'}</span>
  </button>;
}
