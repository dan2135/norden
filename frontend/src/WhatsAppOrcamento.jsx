import { useState } from 'react';
import { linkWhatsApp, mensagemOrcamento, telefoneWhatsApp } from './whatsapp';

export default function WhatsAppOrcamento({ orcamento, projeto, alterado }) {
  const [aberto, setAberto] = useState(false);
  const telefone = telefoneWhatsApp(projeto.telefone);
  const mensagem = mensagemOrcamento(orcamento, projeto);
  const pronto = orcamento.status === 'pronto' && orcamento.itens.length > 0 && Number(orcamento.total_centavos) > 0;
  const bloqueio = alterado ? 'Salve as alterações antes de preparar a mensagem.' : !telefone ? 'O telefone precisa ter DDD e 10 ou 11 dígitos.' : !pronto ? 'Marque como “Pronto para enviar” e salve o orçamento.' : '';

  function abrirWhatsApp() {
    const link = linkWhatsApp(projeto.telefone, mensagem);
    if (link && !bloqueio) window.open(link, '_blank', 'noopener,noreferrer');
  }

  return <section className="whatsapp-orcamento">
    <div><p className="sobretitulo">PASSO 14 · WHATSAPP</p><h4>Enviar orçamento ao cliente</h4>
      <p>A conversa abre com o texto preenchido. Revise e confirme o envio no WhatsApp.</p></div>
    <button type="button" className="botao-whatsapp" disabled={!!bloqueio} onClick={() => setAberto(true)}>Preparar mensagem</button>
    {bloqueio && <p className="nota bloqueio-whatsapp">{bloqueio}</p>}
    {aberto && !bloqueio && <div className="previa-whatsapp" role="dialog" aria-labelledby="titulo-previa-whatsapp">
      <div className="cabecalho-previa"><h5 id="titulo-previa-whatsapp">Prévia para {projeto.telefone}</h5><button type="button" onClick={() => setAberto(false)} aria-label="Fechar prévia">Fechar</button></div>
      <pre>{mensagem}</pre>
      <p className="nota">O sistema apenas abre a conversa. Ele não envia nem registra confirmação automaticamente.</p>
      <button type="button" className="botao-whatsapp" onClick={abrirWhatsApp}>Abrir no WhatsApp</button>
    </div>}
  </section>;
}
