ALTER TABLE projetos ADD COLUMN IF NOT EXISTS excluido_em TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS projetos_lixeira_idx ON projetos (marcenaria_id,excluido_em);
