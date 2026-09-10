-- Adiciona documento, confirmação de e-mail, registro do último acesso, tokens e fila de mensagens.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS documento VARCHAR(14);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_confirmado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_ip VARCHAR(64);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_login_em TIMESTAMPTZ;

UPDATE usuarios SET email_confirmado=TRUE WHERE superadministrador=TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_documento_uq ON usuarios (documento) WHERE documento IS NOT NULL;

CREATE TABLE IF NOT EXISTS tokens_usuario (
  token_hash CHAR(64) PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo VARCHAR(24) NOT NULL CHECK (tipo IN ('confirmar_email','redefinir_senha')),
  expira_em TIMESTAMPTZ NOT NULL,
  usado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS tokens_usuario_idx ON tokens_usuario (usuario_id,tipo,expira_em);

CREATE TABLE IF NOT EXISTS emails_saida (
  id BIGSERIAL PRIMARY KEY,
  destinatario VARCHAR(254) NOT NULL,
  assunto VARCHAR(180) NOT NULL,
  texto TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'simulado',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
