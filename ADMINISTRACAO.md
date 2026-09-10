# Acesso administrativo

O cadastro público e o primeiro acesso criam proprietários de empresa, não administradores globais.

## Criar o administrador de todas as empresas

Preencha no arquivo privado `backend/.env`:

```dotenv
ADMIN_USUARIO="seu_usuario"
ADMIN_EMAIL="seu_email_real"
ADMIN_SENHA="sua_senha_temporaria_forte"
ADMIN_REDEFINIR=false
```

A senha deve ter entre 10 e 200 caracteres. O usuário aceita letras, números, ponto, hífen e sublinhado (3 a 80 caracteres).
O operador atesta que o e-mail pertence ao administrador ao executar este comando confiável; cadastros públicos continuam exigindo confirmação por link.
Não use DB_PASSWORD: essa é a senha do PostgreSQL, não do painel.

Na pasta `backend`, execute manualmente `node provisionar-admin.js`.
O comando altera o banco selecionado por DB_TARGET; confira o destino antes de executá-lo.
Não o coloque na inicialização automática do servidor.

Depois abra `http://127.0.0.1:5176/?tela=login`, entre com o usuário e a senha temporária e defina uma nova senha na tela obrigatória.
A sessão temporária não permite consultar empresas ou projetos. A troca encerra todas as sessões e exige novo login.
Retire ADMIN_SENHA do .env após concluir. Nunca envie esse arquivo ao GitHub.

## Administrador existente

Por padrão, o script recusa sobrescrever um administrador existente. Para redefinir conscientemente, use ADMIN_REDEFINIR=true; depois volte a false.
A redefinição invalida sessões e tokens antigos. Uma conta comum nunca é promovida automaticamente pelo script.
E-mail já usado por outra conta causa conflito e reverte a operação; não apaga a conta existente.

## Arquivos envolvidos

- `backend/admin.js`: valida e provisiona o administrador em transação.
- `backend/provisionar-admin.js`: comando manual que lê a configuração privada.
- `backend/auth.js`: login, sessão restrita e troca da senha.
- `frontend/src/TrocarSenha.jsx`: formulário de senha definitiva, compatível com claro/escuro.

Esta implementação não cria uma conta automaticamente nem altera credenciais reais. Configure e execute o provisionamento somente quando desejar ativar o acesso.
