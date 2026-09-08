CREATE TABLE IF NOT EXISTS orcamentos (
  id BIGSERIAL PRIMARY KEY,
  projeto_id BIGINT NOT NULL UNIQUE REFERENCES projetos(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'pronto', 'aprovado', 'recusado')),
  desconto_centavos BIGINT NOT NULL DEFAULT 0 CHECK (desconto_centavos >= 0),
  validade DATE,
  observacoes TEXT NOT NULL DEFAULT '',
  versao INTEGER NOT NULL DEFAULT 1 CHECK (versao > 0),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orcamento_itens (
  id BIGSERIAL PRIMARY KEY,
  orcamento_id BIGINT NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  descricao VARCHAR(200) NOT NULL CHECK (length(trim(descricao)) > 0),
  categoria VARCHAR(30) NOT NULL CHECK (categoria IN ('material', 'ferragem', 'mao_de_obra', 'transporte', 'outro')),
  quantidade_milesimos INTEGER NOT NULL CHECK (quantidade_milesimos > 0),
  unidade VARCHAR(20) NOT NULL CHECK (unidade IN ('un', 'm', 'm2', 'm3', 'h', 'servico')),
  valor_unitario_centavos BIGINT NOT NULL CHECK (valor_unitario_centavos >= 0),
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS orcamento_itens_orcamento_idx ON orcamento_itens (orcamento_id, ordem, id);
