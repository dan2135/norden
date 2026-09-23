-- Atualiza o preço para R$ 110 somente em testes ainda sem assinatura criada.
-- Assinaturas já contratadas preservam o valor aceito pelo cliente.
ALTER TABLE assinaturas ALTER COLUMN valor_centavos SET DEFAULT 11000;

UPDATE assinaturas
SET valor_centavos = 11000,
    atualizado_em = CURRENT_TIMESTAMP
WHERE status = 'trial'
  AND asaas_subscription_id IS NULL;
