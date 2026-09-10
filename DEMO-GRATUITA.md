# Demonstração separada da Norden

A versão principal foi preservada em `main`, commit `8d734e0`. Esta variante vive em `codex/demo-gratuita`.
As duas versões ainda precisam ser enviadas ao GitHub; nada foi publicado automaticamente.

## O que muda

- E-mails reais por API HTTPS da Brevo, compatível com Render Free. Cadastro continua exigindo confirmação; recuperação e alertas de acesso usam a mesma fila.
- Não há conta universal de demonstração nem desativação de autenticação.
- Banco exclusivo configurado por DEMO_DB_*. O projeto Supabase da demonstração deve ser diferente do principal. Trocar a branch não desfaz dados: esta separação evita misturar cadastros.
- SMTP continua disponível. As configurações privadas locais não foram alteradas.

## Como publicar a demonstração

Crie um serviço Render separado, com nome `norden-demo`, branch `codex/demo-gratuita`, plano Free e Root Directory vazio. Use os comandos de build/start de RENDER-SETUP.md.

No Environment configure:

```text
NODE_ENV=production
NODE_VERSION=24
SERVE_FRONTEND=true
HOST=0.0.0.0
TRUST_PROXY=1
NORDEN_DEMO=true
EMAIL_MODE=brevo
```

Complete privadamente:

- FRONTEND_URL e FRONTEND_ORIGIN: endereço HTTPS real do serviço de demonstração, sem barra final.
- BREVO_API_KEY: chave de API da Brevo (não é a senha SMTP nem a senha Gmail).
- EMAIL_FROM: remetente aprovado na Brevo.
- DEMO_DB_HOST, DEMO_DB_PORT, DEMO_DB_DATABASE, DEMO_DB_USER, DEMO_DB_PASSWORD: dados do projeto Supabase exclusivo para testes.
- DEMO_DB_SSL_CA_FILE: caminho para o certificado público correto do banco de demonstração, quando necessário. TLS continua validado.

Não copie DB_* nem ADMIN_* da versão principal para o serviço de demonstração. Não copie dados reais de clientes para a demonstração.

Crie a conta Brevo, confirme seu e-mail, cadastre/verifique o remetente e habilite o envio transacional. A aprovação e as regras de remetente dependem da Brevo; um Gmail cadastrado não garante autorização de envio. Quando houver domínio próprio, autentique-o. O plano gratuito anuncia 300 envios por dia; confirme as condições da conta antes de liberar convidados.

A configuração não comprova entrega: testar cadastro e recuperação com um endereço autorizado pelo dono após ativar a conta. Nenhum e-mail real foi enviado na preparação.

Suzy/OpenAI é independente da hospedagem gratuita: para usá-la, configurar IA_PROVIDER, OPENAI_MODEL e OPENAI_API_KEY. O consumo da API pode ser cobrado. Sem API ativa, há atendimento por regras, mas o Ollama do PC não ficará acessível no Render.

## Voltar à versão principal

Com as mudanças da demo salvas, use `git switch main`. Para retomar a demo, `git switch codex/demo-gratuita`. Reinicie os servidores depois da troca. O serviço Render da demo deve continuar apontado exclusivamente para a branch da demo.
Os arquivos .env ignorados são compartilhados pelo checkout; não coloque a configuração de demo no .env principal. Cadastre-a no Render. Não remova nem substitua o banco principal para voltar.

## Limites e pendências

Ainda faltam conta/chave/remetente Brevo, projeto Supabase separado, envio ao GitHub, configuração Render e testes online. O Render Free pausa por inatividade, inclusive o processador da fila. E-mails pendentes são retomados quando o serviço acorda e podem expirar; não há garantia de envio contínuo nesse plano.

Fontes: https://render.com/docs/free ; https://developers.brevo.com/reference/send-transac-email ; https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan
