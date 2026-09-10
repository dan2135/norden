-- Adiciona a data de arquivamento de clientes para permitir restauração.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS excluido_em TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS clientes_lixeira_idx ON clientes (marcenaria_id, excluido_em);
