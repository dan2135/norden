-- Repara empresas que ficaram sem vínculos após exclusões anteriores de contas.
-- Preserva dados, empresa principal e empresas que ainda tenham qualquer membro.
UPDATE marcenarias m SET ativa=FALSE
WHERE m.ativa=TRUE AND m.slug<>'principal'
  AND NOT EXISTS (SELECT 1 FROM membros_marcenaria mm WHERE mm.marcenaria_id=m.id);
