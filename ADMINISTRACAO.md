# Onde definir o acesso administrativo

## Acesso pelo painel

Abra `http://127.0.0.1:5176/?tela=login`.
Se o banco ainda não tiver usuários, a tela pede nome, e-mail e senha de pelo menos 10 caracteres.
Esse primeiro cadastro cria o **proprietário da empresa principal**, não o administrador de todas as empresas.
No login comum, preencha os campos **Usuário ou e-mail** e **Senha**. Não escreva credenciais no React.

## Administrador geral (todas as empresas)

O ponto de configuração já existente é `backend/.env`, arquivo privado ignorado pelo Git:

```dotenv
ADMIN_USUARIO=""
ADMIN_SENHA=""
```

Preencha o nome de usuário entre as primeiras aspas e uma senha forte entre as segundas.
Essas variáveis são lidas por `backend/provisionar-admin.js`; não são usadas automaticamente quando o servidor inicia.
`DB_PASSWORD` e a senha de `backend/.env.supabase` são do banco PostgreSQL, NÃO do administrador do painel.
O `.env.example` é apenas um modelo sem segredos, não o arquivo ativo.

### Limitações encontradas no provisionamento atual

Não execute o provisionador esperando um login novo pronto antes de revisar estes pontos:

- Para uma conta nova, ele cria endereço `usuario@local.invalid` e deixa `email_confirmado` no padrão falso. O login exige confirmação de e-mail.
- Ele marca `trocar_senha=true`; o login em produção bloqueia contas nessa condição. O script não implementa a tela de troca.
- Se o usuário já existir, executar novamente **substitui sua senha e concede acesso global**.
- A validação de senha deste script não é a mesma validação do formulário de cadastro.

Nesta tarefa somente a documentação foi alterada: nenhuma conta foi criada, promovida ou teve senha modificada.
Não use a senha antiga curta de demonstração em produção. Não envie senhas em prints, chat ou commits.

## Onde entender o fluxo

- `frontend/src/TelaLogin.jsx`: campos e envio dos formulários.
- `backend/auth.js`: validação, hashes de senha, confirmação e sessões.
- `backend/provisionar-admin.js`: criação manual do administrador geral.
- `backend/marcenarias.js`: verifica quais empresas o usuário pode acessar.
- `backend/database.js`: escolhe banco local ou Supabase; não define o usuário do painel.
