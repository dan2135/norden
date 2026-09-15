-- Preparação da empresa e especificações do catálogo, sem alterar projetos existentes.
ALTER TABLE marcenarias ADD COLUMN IF NOT EXISTS atividade VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE marcenarias ADD COLUMN IF NOT EXISTS configurada_em TIMESTAMPTZ;
ALTER TABLE catalogo_materiais ADD COLUMN IF NOT EXISTS especificacoes VARCHAR(500) NOT NULL DEFAULT '';
