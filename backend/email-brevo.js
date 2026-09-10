/** Transporte HTTPS para a demonstração no Render Free. A fila existente controla as tentativas. */
function criarTransporteBrevo(apiKey, consultar = fetch) {
  return {
    async sendMail({ from, to, subject, text }) {
      let resposta;
      try {
        resposta = await consultar('https://api.brevo.com/v3/smtp/email', {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
          headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ sender: { name: from.name, email: from.address }, to: [{ email: to }], subject, textContent: text }),
        });
      } catch { throw new Error('Serviço de e-mail indisponível.'); }
      // Não propaga o corpo de erro remoto: pode conter endereços e conteúdo privado.
      if (resposta.status !== 201) throw new Error(`Serviço de e-mail recusou a solicitação (HTTP ${resposta.status}).`);
      let dados;
      try { dados = await resposta.json(); } catch { throw new Error('Resposta inválida do serviço de e-mail.'); }
      if (typeof dados.messageId !== 'string' || !dados.messageId) throw new Error('Serviço de e-mail não confirmou a solicitação.');
      // Aceitação pelo provedor não comprova entrega na caixa de entrada.
      return { accepted: [to], messageId: dados.messageId };
    },
    close() {},
  };
}
module.exports = { criarTransporteBrevo };
