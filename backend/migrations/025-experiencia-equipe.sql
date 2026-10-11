-- Complementa a primeira configuração e registra convites de equipe por empresa.
ALTER TABLE marcenarias ADD COLUMN IF NOT EXISTS servicos TEXT NOT NULL DEFAULT '';
ALTER TABLE marcenarias ADD COLUMN IF NOT EXISTS personalidade_suzy VARCHAR(20) NOT NULL DEFAULT 'profissional'
  CHECK (personalidade_suzy IN ('profissional','acolhedora','direta'));

CREATE TABLE IF NOT EXISTS convites_equipe (
  id BIGSERIAL PRIMARY KEY,
  marcenaria_id INTEGER NOT NULL REFERENCES marcenarias(id) ON DELETE CASCADE,
  email VARCHAR(254) NOT NULL,
  papel VARCHAR(20) NOT NULL CHECK (papel IN ('administrador','atendente')),
  token_hash CHAR(64) NOT NULL UNIQUE,
  expira_em TIMESTAMPTZ NOT NULL,
  aceito_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por BIGINT NOT NULL REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS convites_equipe_empresa_idx ON convites_equipe (marcenaria_id, criado_em DESC);
