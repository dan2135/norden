-- Cancela o acesso das empresas de teste DEF e Poli: derruba sessões, invalida tokens,
-- desativa usuários exclusivos dessas empresas e mantém intactos admin e empresa principal.
WITH empresas_alvo AS (
  SELECT id
  FROM marcenarias
  WHERE slug <> 'principal'
    AND (
      lower(trim(nome)) IN ('def', 'poli')
      OR lower(trim(slug)) IN ('def', 'poli')
    )
),
usuarios_alvo AS (
  SELECT DISTINCT mm.usuario_id
  FROM membros_marcenaria mm
  JOIN usuarios u ON u.id = mm.usuario_id
  WHERE mm.marcenaria_id IN (SELECT id FROM empresas_alvo)
    AND COALESCE(u.superadministrador, FALSE) = FALSE
    AND NOT EXISTS (
      SELECT 1
      FROM membros_marcenaria manter
      JOIN marcenarias empresa_manter ON empresa_manter.id = manter.marcenaria_id
      WHERE manter.usuario_id = mm.usuario_id
        AND manter.ativo = TRUE
        AND empresa_manter.ativa = TRUE
        AND empresa_manter.slug = 'principal'
    )
),
sessoes_canceladas AS (
  DELETE FROM sessoes
  WHERE usuario_id IN (SELECT usuario_id FROM usuarios_alvo)
  RETURNING usuario_id
),
tokens_cancelados AS (
  UPDATE tokens_usuario
  SET usado_em = CURRENT_TIMESTAMP
  WHERE usuario_id IN (SELECT usuario_id FROM usuarios_alvo)
    AND usado_em IS NULL
  RETURNING usuario_id
),
vinculos_cancelados AS (
  UPDATE membros_marcenaria
  SET ativo = FALSE
  WHERE marcenaria_id IN (SELECT id FROM empresas_alvo)
     OR usuario_id IN (SELECT usuario_id FROM usuarios_alvo)
  RETURNING usuario_id
),
usuarios_cancelados AS (
  UPDATE usuarios
  SET ativo = FALSE
  WHERE id IN (SELECT usuario_id FROM usuarios_alvo)
  RETURNING id
)
UPDATE marcenarias
SET ativa = FALSE
WHERE id IN (SELECT id FROM empresas_alvo);
