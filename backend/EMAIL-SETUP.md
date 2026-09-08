# E-mails da Norden

A confirmação de cadastro, recuperação de senha e alerta de novo IP usam a mesma fila de saída. O cadastro salva o e-mail na transação; o worker só envia após a confirmação no banco.

## Ativação

1. Crie ou escolha uma conta/provedor de e-mail da empresa e autorize o remetente no provedor.
2. Copie os campos de `email.env.example` para `.env`, preservando os campos do banco. Preencha as credenciais SMTP diretamente no arquivo, nunca no chat ou no frontend.
3. Configure `EMAIL_MODE=smtp`, `EMAIL_FROM` com apenas o endereço autorizado e `FRONTEND_URL` com a URL do painel. Em produção, use a URL pública HTTPS, nunca localhost.
4. Execute `npm run migrate` e `node verificar-email.js` na pasta backend. O verificador não envia mensagens e não garante entrega na caixa de entrada.
5. Reinicie o backend com `npm start`. Faça um cadastro de teste com um e-mail seu, abra a confirmação, teste recuperação e depois o alerta de novo IP. Confira spam também.

Configuração TLS conforme a [documentação oficial do Nodemailer](https://nodemailer.com/smtp): porta 465 usa TLS desde a conexão; 587 exige STARTTLS. Não desabilitamos validação de certificado.

## Operação e limites

- Sem configuração local, permanece `simulado`. Simulação é proibida em produção. Mensagens simuladas antigas nunca serão enviadas automaticamente.
- O worker roda no backend a cada cinco segundos, uma mensagem por ciclo. Não depende de uma aba aberta; futuramente rodará no servidor em nuvem.
- Até cinco tentativas, com intervalo mínimo de um minuto. Uma tentativa interrompida pode ser retomada após cinco minutos. Há possibilidade de duplicata se SMTP aceitar e a aplicação cair antes de registrar o sucesso.
- Mensagens pendentes expiram após 45 minutos para evitar enviar links antigos. Mensagens já simuladas não são alteradas. Conteúdo enviado ou expirado é removido; falhas finais permanecem para diagnóstico restrito ao banco.
- `enviado` significa aceito pelo SMTP, não entrega comprovada. Rejeições posteriores, spam e webhooks de entrega ainda não são acompanhados.
- Consulte somente metadados para diagnóstico: `SELECT id,status,tentativas,criado_em,enviado_em FROM emails_saida ORDER BY id DESC LIMIT 20;` Não exponha a tabela em uma API pública.
- Antes de publicar: validar remetente/domínio, concluir limites de abuso no cadastro/recuperação, reenvio de confirmação, retenção e monitoramento da fila. Não há cobrança de assinatura nem conta de e-mail criada por esta implementação.
