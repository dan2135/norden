-- Adiciona o ramo da empresa; preserva marcenaria como padrão dos registros existentes.
ALTER TABLE marcenarias ADD COLUMN IF NOT EXISTS segmento VARCHAR(30) NOT NULL DEFAULT 'marcenaria';
-- Mantém o comportamento das empresas existentes. Novos cadastros escolhem seu ramo.
