CREATE TABLE IF NOT EXISTS catalogo_materiais (
  id BIGSERIAL PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('chapa', 'fita', 'dobradica', 'corredica', 'puxador', 'outro')),
  descricao VARCHAR(200) NOT NULL CHECK (length(trim(descricao)) > 0),
  fornecedor VARCHAR(120) NOT NULL DEFAULT 'Léo Madeiras',
  unidade_consumo VARCHAR(10) NOT NULL CHECK (unidade_consumo IN ('m2', 'm', 'un')),
  rendimento_milesimos INTEGER NOT NULL CHECK (rendimento_milesimos > 0),
  preco_centavos BIGINT NOT NULL CHECK (preco_centavos >= 0),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS catalogo_materiais_tipo_idx ON catalogo_materiais (tipo, ativo, atualizado_em DESC);
