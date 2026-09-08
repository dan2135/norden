CREATE TABLE IF NOT EXISTS marcenarias (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL CHECK (length(trim(nome)) > 0),
  slug VARCHAR(80) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO marcenarias (nome, slug) VALUES ('Marcenaria principal', 'principal')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS marcenaria_id INTEGER;
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS marcenaria_id INTEGER;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS marcenaria_id INTEGER;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS marcenaria_id INTEGER;
ALTER TABLE catalogo_materiais ADD COLUMN IF NOT EXISTS marcenaria_id INTEGER;

UPDATE clientes SET marcenaria_id = (SELECT id FROM marcenarias WHERE slug='principal') WHERE marcenaria_id IS NULL;
UPDATE projetos p SET marcenaria_id = c.marcenaria_id FROM clientes c WHERE p.cliente_id=c.id AND p.marcenaria_id IS NULL;
UPDATE mensagens m SET marcenaria_id = c.marcenaria_id FROM clientes c WHERE m.cliente_id=c.id AND m.marcenaria_id IS NULL;
UPDATE orcamentos o SET marcenaria_id = p.marcenaria_id FROM projetos p WHERE o.projeto_id=p.id AND o.marcenaria_id IS NULL;
UPDATE catalogo_materiais SET marcenaria_id = (SELECT id FROM marcenarias WHERE slug='principal') WHERE marcenaria_id IS NULL;

ALTER TABLE clientes ALTER COLUMN marcenaria_id SET NOT NULL;
ALTER TABLE projetos ALTER COLUMN marcenaria_id SET NOT NULL;
ALTER TABLE mensagens ALTER COLUMN marcenaria_id SET NOT NULL;
ALTER TABLE orcamentos ALTER COLUMN marcenaria_id SET NOT NULL;
ALTER TABLE catalogo_materiais ALTER COLUMN marcenaria_id SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE clientes ADD CONSTRAINT clientes_marcenaria_fk FOREIGN KEY (marcenaria_id) REFERENCES marcenarias(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE projetos ADD CONSTRAINT projetos_marcenaria_fk FOREIGN KEY (marcenaria_id) REFERENCES marcenarias(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE mensagens ADD CONSTRAINT mensagens_marcenaria_fk FOREIGN KEY (marcenaria_id) REFERENCES marcenarias(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE orcamentos ADD CONSTRAINT orcamentos_marcenaria_fk FOREIGN KEY (marcenaria_id) REFERENCES marcenarias(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE catalogo_materiais ADD CONSTRAINT catalogo_marcenaria_fk FOREIGN KEY (marcenaria_id) REFERENCES marcenarias(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_telefone_key;
CREATE UNIQUE INDEX IF NOT EXISTS clientes_marcenaria_telefone_uq ON clientes (marcenaria_id, telefone);
CREATE INDEX IF NOT EXISTS projetos_marcenaria_idx ON projetos (marcenaria_id, atualizado_em DESC, id DESC);
CREATE INDEX IF NOT EXISTS mensagens_marcenaria_idx ON mensagens (marcenaria_id, projeto_id, criado_em, id);
CREATE INDEX IF NOT EXISTS orcamentos_marcenaria_idx ON orcamentos (marcenaria_id, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS catalogo_marcenaria_idx ON catalogo_materiais (marcenaria_id, tipo, ativo);
