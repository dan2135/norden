import { useRef, useState } from 'react';
import { contatoNorden, paginasInstitucionais } from './institucional';
import './Rodape.css';

export default function Rodape() {
  const [pagina, setPagina] = useState(null);
  const titulo = useRef(null);
  const origem = useRef(null);
  const conteudo = paginasInstitucionais[pagina];
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contatoNorden.email) ? contatoNorden.email : '';
  const telefone = /^\d{10,15}$/.test(contatoNorden.whatsapp) ? contatoNorden.whatsapp : '';

  function abrir(chave, botao) {
    origem.current = botao;
    setPagina(chave);
    requestAnimationFrame(() => titulo.current?.focus());
  }
  function fechar() { setPagina(null); origem.current?.focus(); }

  return <footer className="rodape-norden" aria-label="Informações da Norden">
    <div className="rodape-norden-linha">
      <div className="rodape-norden-marca"><span aria-hidden="true">N</span>
        <div><strong>Norden</strong><p>Mais organização para sua empresa.</p></div>
      </div>
      <p className="rodape-norden-copyright">© {new Date().getFullYear()} Norden. Todos os direitos reservados.</p>
    </div>
    <nav className="rodape-links" aria-label="Ajuda e informações institucionais">
      {[['sobre', 'Sobre nós'], ['ajuda', 'Ajuda'], ['suporte', 'Suporte'], ['privacidade', 'Privacidade'], ['termos', 'Termos']].map(([chave, texto]) =>
        <button key={chave} type="button" aria-expanded={pagina === chave} aria-controls="rodape-conteudo" onClick={e => abrir(chave, e.currentTarget)}>{texto}</button>)}
    </nav>
    {pagina && <section id="rodape-conteudo" className="rodape-pagina" aria-labelledby="rodape-titulo">
      <header><h2 id="rodape-titulo" ref={titulo} tabIndex={-1}>{conteudo?.titulo || 'Suporte'}</h2><button type="button" onClick={fechar}>Fechar</button></header>
      {conteudo?.rascunho && <p className="rodape-rascunho">Rascunho para revisão — ainda não publicado como documento definitivo.</p>}
      {conteudo?.blocos.map(([subtitulo, texto]) => <div className="rodape-bloco" key={subtitulo}><h3>{subtitulo}</h3><p>{texto}</p></div>)}
      {pagina === 'privacidade' && <p><a href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1" target="_blank" rel="noreferrer">Informações da ANPD sobre dados pessoais (abre em nova aba)</a></p>}
      {pagina === 'suporte' && <>
        <p>Precisa de ajuda com a Norden? Ao relatar um problema, informe a tela utilizada, o que estava tentando fazer e a mensagem de erro.</p>
        <p>Não envie senhas, links de recuperação ou dados pessoais de clientes no relato.</p>
        <div className="rodape-contatos">
          {email && <a href={`mailto:${email}?subject=${encodeURIComponent('Suporte Norden')}`}>Enviar e-mail ao suporte</a>}
          {telefone && <a href={`https://wa.me/${telefone}`} target="_blank" rel="noreferrer">Falar no WhatsApp (abre em nova aba)</a>}
        </div>
        {!email && !telefone && <p className="rodape-rascunho">Os canais oficiais de suporte ainda não foram cadastrados. Durante os testes, fale diretamente com o responsável pela implantação.</p>}
        <button type="button" className="rodape-ajuda" onClick={() => { setPagina('ajuda'); requestAnimationFrame(() => titulo.current?.focus()); }}>Consultar a central de ajuda</button>
      </>}
    </section>}
  </footer>;
}
