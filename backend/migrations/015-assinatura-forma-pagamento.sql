-- Forma de pagamento escolhida na assinatura: Pix recorrente ou cartão recorrente.
ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS billing_type VARCHAR(20) NOT NULL DEFAULT 'PIX';
