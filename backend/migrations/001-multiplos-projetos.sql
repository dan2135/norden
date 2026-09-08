BEGIN;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS projeto_id INTEGER REFERENCES projetos(id);
CREATE INDEX IF NOT EXISTS mensagens_projeto_historico_idx ON mensagens (cliente_id, projeto_id, criado_em, id);
CREATE INDEX IF NOT EXISTS projetos_cliente_idx ON projetos (cliente_id, id);

-- Só atribui histórico antigo quando há exatamente um projeto, sem adivinhar.
UPDATE mensagens m SET projeto_id = unico.projeto_id
FROM (
  SELECT cliente_id, MIN(id) AS projeto_id FROM projetos
  GROUP BY cliente_id HAVING COUNT(*) = 1
) unico
WHERE m.cliente_id = unico.cliente_id AND m.projeto_id IS NULL;
COMMIT;
