-- Configuração de WhatsApp por empresa. Permite vários números no mesmo app/webhook.
CREATE TABLE IF NOT EXISTS whatsapp_configuracoes (
  id BIGSERIAL PRIMARY KEY,
  marcenaria_id INTEGER NOT NULL UNIQUE REFERENCES marcenarias(id) ON DELETE CASCADE,
  waba_id VARCHAR(40) NOT NULL DEFAULT '',
  phone_number_id VARCHAR(40) NOT NULL UNIQUE CHECK (phone_number_id ~ '^[0-9]{5,40}$'),
  numero VARCHAR(30) NOT NULL DEFAULT '',
  access_token TEXT NOT NULL DEFAULT '',
  api_version VARCHAR(10) NOT NULL DEFAULT 'v25.0' CHECK (api_version ~ '^v[0-9]+[.][0-9]+$'),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS whatsapp_configuracoes_ativo_idx
  ON whatsapp_configuracoes (phone_number_id, ativo);
