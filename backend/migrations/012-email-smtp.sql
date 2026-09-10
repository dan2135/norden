-- Acrescenta tentativas e agendamento da fila SMTP para controlar reenvios.
ALTER TABLE emails_saida ADD COLUMN IF NOT EXISTS tentativas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE emails_saida ADD COLUMN IF NOT EXISTS proxima_tentativa_em TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE emails_saida ADD COLUMN IF NOT EXISTS enviado_em TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS emails_saida_fila_idx ON emails_saida (proxima_tentativa_em,id) WHERE status IN ('pendente','enviando');
