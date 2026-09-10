-- Cria usuários, vínculos de acesso e sessões. senha_hash guarda a derivação da senha, não a senha original.
CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL CHECK (length(trim(nome)) > 0),
  email VARCHAR(254) NOT NULL,
  senha_hash TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_uq ON usuarios (lower(email));

CREATE TABLE IF NOT EXISTS membros_marcenaria (
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  marcenaria_id INTEGER NOT NULL REFERENCES marcenarias(id) ON DELETE CASCADE,
  papel VARCHAR(20) NOT NULL DEFAULT 'atendente'
    CHECK (papel IN ('proprietario', 'administrador', 'atendente')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, marcenaria_id)
);

CREATE INDEX IF NOT EXISTS membros_marcenaria_empresa_idx
  ON membros_marcenaria (marcenaria_id, usuario_id) WHERE ativo = TRUE;

CREATE TABLE IF NOT EXISTS sessoes (
  token_hash CHAR(64) PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  csrf_token CHAR(64) NOT NULL,
  expira_em TIMESTAMPTZ NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_uso_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS sessoes_usuario_idx ON sessoes (usuario_id);
CREATE INDEX IF NOT EXISTS sessoes_expiracao_idx ON sessoes (expira_em);
