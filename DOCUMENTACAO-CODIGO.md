# Guia do código da Norden

Este documento explica onde cada parte importante da plataforma fica. Os arquivos centrais também têm comentários próximos aos fluxos que exigem mais contexto.

## Estrutura

- `frontend/`: telas que o cliente e o administrador usam no navegador.
- `backend/`: API, autenticação, cobrança, e-mails e integração com WhatsApp.
- `backend/migrations/`: alterações na estrutura do banco de dados, executadas em ordem.
- `backend/tests/`: testes automatizados dos fluxos mais sensíveis.

## Frontend

- `frontend/src/App.jsx`: decide entre site público, login e área autenticada. Também guarda a empresa ativa, a busca de empresas e a navegação lateral.
- `frontend/src/LandingPage.jsx`: página pública da Norden, com apresentação, planos e links de contato.
- `frontend/src/Painel.jsx`: lista clientes e projetos, filtros, ficha do projeto e orçamento.
- `frontend/src/ConfiguracaoEmpresa.jsx`: dados da empresa, ramo, materiais e conexão do WhatsApp pela Meta.
- `frontend/src/Assinatura.jsx`: tela de plano e início da assinatura por cartão.
- `frontend/src/api.js`: ponto único das chamadas do navegador para a API; inclui a empresa ativa e proteção CSRF.
- `frontend/src/tema.js`: guarda a escolha entre modo claro e escuro no navegador.

## Backend

- `backend/server.js`: cria o servidor Express, aplica proteções comuns e registra as rotas principais.
- `backend/auth.js`: cadastro, confirmação de e-mail, login, sessão, recuperação e troca de senha. Senhas nunca são gravadas em texto simples.
- `backend/marcenarias.js`: cadastro e leitura das empresas às quais cada usuário tem acesso.
- `backend/configuracao-empresa.js`: dados de perfil, materiais e configurações da empresa ativa.
- `backend/asaas.js`: valida dados de cobrança, cria assinatura por cartão e recebe atualizações do Asaas.
- `backend/email.js`: coloca e-mails em fila, controla tentativas e remove o conteúdo depois do envio. Pode usar SMTP ou Brevo.
- `backend/email-brevo.js`: adaptador que envia mensagens pela API da Brevo.
- `backend/whatsapp.js`: conexão com a Meta e recebimento de conversas do WhatsApp.

## Fluxo de uma empresa

1. A pessoa cria uma conta e confirma o e-mail.
2. Cria ou escolhe uma empresa no topo do painel.
3. A empresa configura ramo, materiais e número comercial.
4. Quando o WhatsApp está conectado, as mensagens viram clientes e projetos no painel.
5. A pessoa revisa os dados e prepara o orçamento. A decisão de enviar ou cobrar permanece com ela.

## Configurações privadas

As chaves, senhas e tokens ficam apenas nas variáveis de ambiente da Render ou no arquivo local `backend/.env`, que não é enviado ao Git. Os nomes das configurações disponíveis estão em `backend/.env.example`.

## Como alterar com segurança

1. Altere a tela no `frontend/src` ou a rota correspondente no `backend`.
2. Execute os testes relacionados na pasta `backend` quando mudar regras de negócio.
3. Execute `pnpm run build` na pasta `frontend` para verificar a versão de produção.
4. Nunca coloque chaves, documentos pessoais ou dados de clientes no código ou nos commits.
