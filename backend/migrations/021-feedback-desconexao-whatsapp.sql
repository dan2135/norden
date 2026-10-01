-- Guarda somente o motivo informado pela empresa; desconectar revoga o token salvo na Norden.
CREATE TABLE IF NOT EXISTS whatsapp_desconexoes (
  id BIGSERIAL PRIMARY KEY,
  marcenaria_id INTEGER NOT NULL REFERENCES marcenarias(id) ON DELETE CASCADE,
  motivo TEXT NOT NULL CHECK (char_length(motivo) BETWEEN 1 AND 1000),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
