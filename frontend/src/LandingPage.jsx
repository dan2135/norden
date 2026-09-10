/**
 * Página pública de apresentação: benefícios, Suzy e proposta de planos. Os links levam aos formulários existentes; esta página não ativa cobrança.
 */
import { useTema } from './tema';
import { contatoNorden } from './institucional';
import './LandingPage.css';

const entrar = '/?tela=login';
const registrar = '/?tela=cadastro';
const beneficios = [
  ['01', 'Cada conversa vira contexto.', 'A Suzy ajuda a coletar o pedido. Você acompanha o histórico sem começar do zero a cada atendimento.', 'Atendimento com memória'],
  ['02', 'Tudo no lugar certo.', 'Clientes, solicitações e projetos organizados por empresa. Encontre o que precisa e acompanhe o que falta.', 'Uma visão do seu negócio'],
  ['03', 'Do pedido à proposta.', 'Monte orçamentos, revise os itens e compartilhe a proposta pelo WhatsApp. A decisão final continua com você.', 'Mais clareza para vender'],
];

function Check({children}) { return <li><span aria-hidden="true">✓</span>{children}</li>; }

export default function LandingPage() {
  const [escuro, alternarTema] = useTema();
  return <div className="landing" data-theme={escuro ? 'dark' : 'light'}>
    <a className="lp-skip" href="#conteudo">Pular para o conteúdo</a>
    <header className="lp-header"><nav className="lp-nav" aria-label="Navegação principal">
      <a className="lp-brand" href="/" aria-label="Norden início"><span aria-hidden="true">n</span>norden<span className="lp-brand-dot">.</span></a>
      <div className="lp-nav-sections"><a href="#beneficios">Por que Norden?</a><a href="#suzy">Conheça a Suzy</a><a href="#planos">Planos</a></div>
      <div className="lp-nav-access"><button type="button" className="lp-theme-toggle" onClick={alternarTema} aria-label="Modo escuro" aria-pressed={escuro} title={escuro ? 'Ativar modo claro' : 'Ativar modo escuro'}><span aria-hidden="true">{escuro ? '☀' : '☾'}</span></button><a href={entrar}>Entrar</a><a className="lp-button lp-small" href={registrar}>Criar conta <span aria-hidden="true">↗</span></a></div>
    </nav></header>
    <main id="conteudo">
      <section className="lp-hero lp-container">
        <div className="lp-hero-copy"><p className="lp-eyebrow"><span className="lp-mini-icon" aria-hidden="true">✳</span> MENOS TAREFAS SOLTAS. MAIS POSSIBILIDADES.</p>
          <h1>Seu negócio,<br/>mais organizado.<br/><em>Seu tempo, de volta.</em></h1>
          <p className="lp-intro">Atendimento, clientes e orçamentos em um só lugar. Com a Suzy ao seu lado, cada pedido ganha um próximo passo.</p>
          <div className="lp-hero-actions"><a className="lp-button" href={registrar}>Conhecer na prática <span aria-hidden="true">↗</span></a><a className="lp-text-link" href="#como-funciona">Veja como funciona <span aria-hidden="true">↓</span></a></div>
          <p className="lp-caption">Feito para quem cuida de um negócio de verdade.</p>
        </div>
        <div className="lp-preview" aria-label="Prévia ilustrativa da organização de um projeto">
          <div className="lp-preview-top"><strong><span aria-hidden="true">n.</span> Meu espaço</strong><span className="lp-demo-label">DEMONSTRAÇÃO</span></div>
          <div className="lp-preview-body"><div className="lp-preview-title"><div><small>UM NOVO DIA, TUDO EM ORDEM</small><h2>Vamos dar o próximo passo?</h2></div><span className="lp-avatar">M</span></div>
            <div className="lp-preview-stats"><div><span>Clientes</span><strong>Organizados</strong></div><div><span>Projetos</span><strong>Conectados</strong></div><div><span>Orçamentos</span><strong>À mão</strong></div></div>
            <div className="lp-project"><span className="lp-project-icon" aria-hidden="true">▤</span><div><strong>Projeto da Marina</strong><small>Detalhes reunidos em uma única ficha</small></div><span className="lp-status">Em coleta</span></div>
            <div className="lp-chat"><div className="lp-chat-heading"><span className="lp-suzy-avatar" aria-hidden="true">S</span><div><strong>Suzy</strong><small>Sua assistente virtual</small></div><span aria-hidden="true">✳</span></div><p className="lp-bubble lp-bubble-client">Quero um orçamento para o meu projeto.</p><p className="lp-bubble lp-bubble-suzy">Claro! Me conta um pouco mais sobre o que você precisa?</p><div className="lp-chat-input">Conversa que vira organização.<span aria-hidden="true">↗</span></div></div>
          </div>
          <div className="lp-preview-note"><span aria-hidden="true">✓</span> Informações juntas. Decisões nas suas mãos.</div>
        </div>
      </section>
      <section className="lp-audience" aria-label="Para diferentes negócios"><div className="lp-container"><p>Seu ramo muda.<br/><strong>A organização fica.</strong></p><span>Prestadores de serviços</span><span>Comércio</span><span>Marcenarias</span><span>Seu próximo negócio</span></div></section>
      <section className="lp-section lp-container" id="beneficios"><div className="lp-section-heading"><p className="lp-eyebrow">MAIS CLAREZA NA ROTINA</p><h2>O trabalho já é muito.<br/>Organizar não precisa ser.</h2><p>Menos informação espalhada e mais espaço para cuidar do que faz sua empresa crescer.</p></div>
        <div className="lp-benefits">{beneficios.map(([numero,titulo,texto,etiqueta])=><article key={numero}><span className="lp-number">{numero}</span><p className="lp-card-label">{etiqueta}</p><h3>{titulo}</h3><p>{texto}</p></article>)}</div>
      </section>
      <section className="lp-suzy-section lp-container" id="suzy"><div className="lp-suzy-message"><span className="lp-suzy-avatar large" aria-hidden="true">S</span><p>“Oi, eu sou a Suzy,<br/>assistente virtual<br/>da sua empresa.”</p><span className="lp-suzy-signature">Um atendimento com a sua identidade.</span></div><div><p className="lp-eyebrow">CONHEÇA SUA NOVA PARCEIRA</p><h2>Suzy conversa.<br/>Você acompanha.</h2><p>Uma assistente que ajuda a reunir informações e manter o contexto de cada projeto. Tudo disponível para você conferir no painel.</p><ul className="lp-checks"><Check>Apresentação com o nome da sua empresa</Check><Check>Coleta guiada conforme o ramo do negócio</Check><Check>Histórico para retomar cada atendimento</Check></ul><p className="lp-note">O atendimento automático no WhatsApp está em desenvolvimento. Hoje, você pode compartilhar os orçamentos manualmente.</p></div></section>
      <section className="lp-section lp-container" id="como-funciona"><div className="lp-section-heading"><p className="lp-eyebrow">DO PRIMEIRO OI AO PRÓXIMO PROJETO</p><h2>Uma rotina mais simples,<br/>em três passos.</h2></div><ol className="lp-steps"><li><span>1</span><h3>Crie seu espaço</h3><p>Cadastre sua empresa, escolha o ramo e confirme seu e-mail.</p></li><li><span>2</span><h3>Reúna os pedidos</h3><p>Use o atendimento para organizar o cliente, os detalhes e o histórico.</p></li><li><span>3</span><h3>Transforme em proposta</h3><p>Revise as informações e prepare um orçamento para compartilhar.</p></li></ol></section>
      <section className="lp-plans-section" id="planos"><div className="lp-container"><div className="lp-section-heading centered"><p className="lp-eyebrow">COMECE NO SEU TEMPO</p><h2>Primeiro, conheça.<br/>Depois, escolha continuar.</h2><p>Uma proposta simples para experimentar a plataforma e levar mais organização para sua empresa.</p></div><div className="lp-plan-grid">
        <article className="lp-plan"><span className="lp-plan-tag">PARA EXPERIMENTAR</span><h3>Primeiro mês grátis</h3><p>Conheça uma nova forma de organizar o negócio.</p><div className="lp-price">R$ 0 <span>/ primeiro mês</span></div><ul className="lp-checks"><Check>Conheça o painel e a Suzy</Check><Check>Explore clientes, projetos e orçamentos</Check><Check>Avalie se faz sentido para sua rotina</Check></ul><a className="lp-button lp-outline" href={registrar}>Criar meu cadastro <span aria-hidden="true">↗</span></a></article>
        <article className="lp-plan lp-plan-paid"><span className="lp-plan-tag">PREÇO INICIAL</span><h3>Plano profissional</h3><p>Um próximo passo para a gestão do seu negócio.</p><div className="lp-price">R$ 90 <span>/ mês após o período gratuito</span></div><ul className="lp-checks"><Check>Continuidade após o período de experiência</Check><Check>Condições apresentadas antes da contratação</Check><Check>Ativação mediante sua escolha</Check></ul><a className="lp-button lp-white" href={registrar}>Conhecer a plataforma <span aria-hidden="true">↗</span></a></article>
      </div><p className="lp-plan-disclaimer">Preço inicial previsto para o lançamento: R$ 90 por mês após o primeiro mês grátis. O período gratuito e a assinatura ainda estão em implementação. Criar um cadastro agora não ativa cobrança nem inicia um prazo de teste; limites e condições serão informados antes da contratação.</p></div></section>
      <section className="lp-final lp-container"><p className="lp-eyebrow">VAMOS ORGANIZAR O PRÓXIMO PASSO?</p><h2>Mais espaço para<br/>o seu negócio acontecer.</h2><a className="lp-button" href={registrar}>Criar minha conta <span aria-hidden="true">↗</span></a></section>
    </main>
    <footer className="lp-footer lp-container"><a className="lp-brand" href="/">norden.</a><p>Gestão e atendimento, lado a lado.</p><div><a href={entrar}>Entrar</a><a href={registrar}>Criar conta</a><a href="#planos">Planos</a></div><small>Contato: <a href={`mailto:${contatoNorden.email}`}>{contatoNorden.email}</a></small><small>WhatsApp: <a href={`https://wa.me/${contatoNorden.whatsapp}`} target="_blank" rel="noreferrer">{contatoNorden.whatsappFormatado} (abre em nova aba)</a></small><small>© {new Date().getFullYear()} Norden.</small></footer>
  </div>;
}
