-- Adiciona o estado JSON da coleta, usado para guardar pendências e a pergunta em andamento.
BEGIN;
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS coleta JSONB NOT NULL DEFAULT '{}'::jsonb;
COMMIT;
