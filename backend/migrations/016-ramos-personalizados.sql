-- Guarda ramos digitados pelos usuários e um catálogo-base reaproveitável por ramo.
CREATE TABLE IF NOT EXISTS ramos_personalizados (
  id SERIAL PRIMARY KEY,
  chave VARCHAR(120) NOT NULL UNIQUE CHECK (chave ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  nome VARCHAR(200) NOT NULL CHECK (length(trim(nome)) > 0),
  segmento VARCHAR(30) NOT NULL DEFAULT 'outros',
  usos INTEGER NOT NULL DEFAULT 1 CHECK (usos > 0),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catalogo_modelos_ramo (
  id BIGSERIAL PRIMARY KEY,
  ramo_chave VARCHAR(120) NOT NULL REFERENCES ramos_personalizados(chave) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('chapa', 'fita', 'dobradica', 'corredica', 'puxador', 'outro')),
  descricao VARCHAR(200) NOT NULL CHECK (length(trim(descricao)) > 0),
  fornecedor VARCHAR(120) NOT NULL DEFAULT '',
  unidade_consumo VARCHAR(10) NOT NULL CHECK (unidade_consumo IN ('m2', 'm', 'un')),
  rendimento_milesimos INTEGER NOT NULL CHECK (rendimento_milesimos > 0),
  preco_centavos BIGINT NOT NULL CHECK (preco_centavos >= 0),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  especificacoes VARCHAR(500) NOT NULL DEFAULT '',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS catalogo_modelos_ramo_item_uq
  ON catalogo_modelos_ramo (ramo_chave, tipo, descricao, fornecedor);

CREATE INDEX IF NOT EXISTS catalogo_modelos_ramo_chave_idx
  ON catalogo_modelos_ramo (ramo_chave, ativo, atualizado_em DESC);
