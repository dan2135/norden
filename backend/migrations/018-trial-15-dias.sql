-- Reduz o teste grátis padrão para 15 dias e encurta somente trials locais ainda sem assinatura criada no Asaas.
ALTER TABLE assinaturas ALTER COLUMN trial_fim_em SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '15 days');

UPDATE assinaturas
SET trial_fim_em = trial_inicio_em + INTERVAL '15 days',
    proxima_cobranca_em = LEAST(COALESCE(proxima_cobranca_em, (trial_inicio_em + INTERVAL '15 days')::date), (trial_inicio_em + INTERVAL '15 days')::date),
    atualizado_em = CURRENT_TIMESTAMP
WHERE status = 'trial'
  AND asaas_subscription_id IS NULL
  AND trial_fim_em > trial_inicio_em + INTERVAL '15 days';
