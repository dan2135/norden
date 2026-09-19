-- Estrutura mínima para controlar planos, pagamentos e webhooks do Asaas por empresa.
CREATE TABLE IF NOT EXISTS assinaturas (
  id BIGSERIAL PRIMARY KEY,
  marcenaria_id INTEGER NOT NULL REFERENCES marcenarias(id) ON DELETE CASCADE,
  plano VARCHAR(40) NOT NULL DEFAULT 'pro',
  status VARCHAR(30) NOT NULL DEFAULT 'trial',
  valor_centavos INTEGER NOT NULL DEFAULT 9000 CHECK (valor_centavos >= 0),
  trial_inicio_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  trial_fim_em TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '15 days'),
  asaas_customer_id VARCHAR(80),
  asaas_subscription_id VARCHAR(80),
  proxima_cobranca_em DATE,
  ultimo_evento VARCHAR(80),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS assinaturas_marcenaria_uq ON assinaturas (marcenaria_id);
CREATE UNIQUE INDEX IF NOT EXISTS assinaturas_asaas_subscription_uq ON assinaturas (asaas_subscription_id) WHERE asaas_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS pagamentos (
  id BIGSERIAL PRIMARY KEY,
  assinatura_id BIGINT REFERENCES assinaturas(id) ON DELETE SET NULL,
  marcenaria_id INTEGER NOT NULL REFERENCES marcenarias(id) ON DELETE CASCADE,
  asaas_payment_id VARCHAR(80) NOT NULL,
  status VARCHAR(40) NOT NULL,
  valor_centavos INTEGER NOT NULL DEFAULT 0,
  vencimento_em DATE,
  confirmado_em TIMESTAMPTZ,
  invoice_url TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_asaas_payment_uq ON pagamentos (asaas_payment_id);
CREATE INDEX IF NOT EXISTS pagamentos_marcenaria_idx ON pagamentos (marcenaria_id, atualizado_em DESC);

CREATE TABLE IF NOT EXISTS eventos_asaas (
  id BIGSERIAL PRIMARY KEY,
  evento_id VARCHAR(120),
  evento VARCHAR(80) NOT NULL,
  asaas_payment_id VARCHAR(80),
  asaas_subscription_id VARCHAR(80),
  payload JSONB NOT NULL,
  processado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS eventos_asaas_evento_id_uq ON eventos_asaas (evento_id) WHERE evento_id IS NOT NULL;
