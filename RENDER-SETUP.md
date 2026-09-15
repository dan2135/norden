# Norden no Render

Nesta branch de demonstração, seguir primeiro DEMO-GRATUITA.md: branch codex/demo-gratuita, EMAIL_MODE=brevo e banco exclusivo DEMO_DB_*. As instruções abaixo documentam a versão principal e os comandos comuns.

Preparação local concluída; publicação e teste online ainda pendentes.
O mesmo Web Service entrega o frontend e a API, mantendo cookies de login no mesmo endereço.

## Configuração do serviço

- Language: Node
- Branch: main
- Root Directory: deixar vazio (substitui a orientação anterior de usar backend)
- Build Command: `npm --prefix backend ci && npm --prefix frontend ci --include=dev && npm --prefix frontend run build`
- Start Command: `npm --prefix backend start`
- Health Check Path: `/api/status` (confirma processo; não testa o banco)
- Node: configurar `NODE_VERSION=24`

O start aplica as migrações existentes antes de iniciar. Use um projeto Supabase separado para testes caso não queira compartilhar o banco atual com a prévia.

## Variáveis privadas no Render

Defina em Environment; não envie arquivos .env para o GitHub.

| Variável | Valor |
| --- | --- |
| NODE_ENV | production |
| SERVE_FRONTEND | true |
| HOST | 0.0.0.0 |
| TRUST_PROXY | 1 (Render termina HTTPS antes de encaminhar ao Node) |
| FRONTEND_URL | URL HTTPS real fornecida pelo Render, sem barra final |
| FRONTEND_ORIGIN | Mesmo valor de FRONTEND_URL |
| DB_TARGET | supabase |
| DB_HOST / DB_PORT / DB_DATABASE / DB_USER / DB_PASSWORD | Copiar individualmente da configuração privada do Supabase |
| DB_SSL | true |
| DB_SSL_CA_FILE | ../prod-ca-2021.crt |
| EMAIL_MODE | smtp, somente em hospedagem com SMTP liberado |
| SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / EMAIL_FROM | Configuração privada já usada localmente |
| ASAAS_API_KEY | Chave privada do Asaas |
| ASAAS_BASE_URL | `https://api.asaas.com/v3` em produção ou `https://api-sandbox.asaas.com/v3` em testes |
| ASAAS_WEBHOOK_TOKEN | Mesmo token informado no webhook do Asaas |
| NORDEN_PLANO_VALOR | `9000` para R$ 90,00 |
| NORDEN_TRIAL_DIAS | `30` |
| WHATSAPP_TOKEN | Token temporário/permanente da Meta WhatsApp Cloud API |
| WHATSAPP_PHONE_NUMBER_ID | ID do número exibido na tela de teste da Meta |
| WHATSAPP_BUSINESS_ACCOUNT_ID | ID da conta WhatsApp Business |
| WHATSAPP_VERIFY_TOKEN | `norden_whatsapp_2026` ou outro valor igual ao cadastrado na Meta |
| WHATSAPP_API_VERSION | `v25.0` |
| WHATSAPP_MARCENARIA_SLUG ou WHATSAPP_MARCENARIA_ID | Empresa do Norden que receberá as mensagens do WhatsApp |

Em produção, DB_* é lido das variáveis do Render, sem depender de .env.supabase. O certificado público prod-ca-2021.crt precisa acompanhar o código; nunca desabilite a validação TLS.
Não configure ADMIN_SENHA no Render: a conta existente permanece no Supabase.
PORT é fornecida pelo Render. Não defina VITE_API_URL: o build usa /api no próprio domínio.

## Webhook do Asaas

Cadastre no painel do Asaas:

- URL: `https://SEU-DOMINIO.onrender.com/api/webhooks/asaas`
- Versão: v3
- Token de autenticação: o mesmo valor de `ASAAS_WEBHOOK_TOKEN`
- Eventos de cobranças: `PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_UPDATED`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED`

## Webhook do WhatsApp

Cadastre na Meta:

- Callback URL: `https://SEU-DOMINIO.onrender.com/api/webhooks/whatsapp`
- Verify token: mesmo valor de `WHATSAPP_VERIFY_TOKEN`
- Campo de webhook: `messages`

Na primeira versão, um número do WhatsApp atende uma empresa do Norden. Use `WHATSAPP_MARCENARIA_ID` quando quiser apontar explicitamente para uma empresa específica.

## Pendências antes de liberar para amigos

1. Enviar o código atualizado ao GitHub.
2. Resolver e-mail: o Render Free bloqueia SMTP nas portas 25, 465 e 587. Para manter o plano Free, implementar envio por API HTTPS e configurar o provedor; alternativamente, escolher uma hospedagem com SMTP liberado. Não use e-mail simulado nem remova a confirmação de cadastro.
3. Para Suzy com OpenAI, configurar IA_PROVIDER=openai, OPENAI_API_KEY e OPENAI_MODEL e fazer um teste real. Sem ativação, o atendimento tem regras locais; o Ollama do computador não estará disponível no Render.
4. Configurar as variáveis e publicar. Conferir cadastro/confirmar e-mail, login/logout, recuperação, isolamento de empresas, projetos, lixeira, orçamento e atendimento.
5. O amigo deve criar a própria conta; não compartilhar o administrador global.

Referências: https://render.com/docs/deploy-node-express-app e https://render.com/docs/free
