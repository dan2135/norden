/** Aviso de cookies com escolha equivalente entre preferências opcionais e apenas essenciais. */
import { useState } from 'react';
import { lerConsentimentoCookies, registrarConsentimentoCookies } from './privacidade';
import './AvisoCookies.css';

export default function AvisoCookies() {
  const [visivel, setVisivel] = useState(() => !lerConsentimentoCookies());
  if (!visivel) return null;
  function escolher(aceitar) {
    registrarConsentimentoCookies(aceitar);
    setVisivel(false);
  }
  return <aside className="aviso-cookies" role="dialog" aria-label="Preferências de cookies" aria-live="polite">
    <strong>Sua privacidade na Norden</strong>
    <p>Usamos um cookie essencial para manter seu login seguro. Você pode permitir que o navegador também lembre o tema e a última empresa usada neste dispositivo.</p>
    <div>
      <button type="button" className="cookies-essenciais" onClick={() => escolher(false)}>Usar só o necessário</button>
      <button type="button" className="cookies-aceitar" onClick={() => escolher(true)}>Aceitar preferências</button>
    </div>
    <small>Você poderá revisar essa escolha na Política de privacidade.</small>
  </aside>;
}
