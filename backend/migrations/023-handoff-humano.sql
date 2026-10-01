ALTER TABLE projetos ADD COLUMN IF NOT EXISTS motivo_atendimento_humano VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS resumo_atendimento_humano TEXT NOT NULL DEFAULT '';
