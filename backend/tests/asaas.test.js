/**
 * Testes unitários da configuração de cobrança, sem chamar a API real do Asaas.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { configurarAsaas, resumoAssinatura, validarFormaPagamento } = require('../asaas');

test('configuração do Asaas usa HTTPS, valor e trial padrão', () => {
  const config = configurarAsaas({ ASAAS_API_KEY:'chave', ASAAS_BASE_URL:'https://api.asaas.com/v3/', NORDEN_PLANO_VALOR:'9000', NORDEN_TRIAL_DIAS:'30' });
  assert.equal(config.baseUrl, 'https://api.asaas.com/v3');
  assert.equal(config.valorCentavos, 9000);
  assert.equal(config.trialDias, 30);
});

test('aceita variável legada digitada sem L final para evitar erro no Render', () => {
  const config = configurarAsaas({ ASAAS_API_KEY:'chave', ASAAS_BASE_UR:'https://api-sandbox.asaas.com/v3' });
  assert.equal(config.baseUrl, 'https://api-sandbox.asaas.com/v3');
});

test('resumo mostra valor em reais e dias restantes do teste grátis', () => {
  const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const resumo = resumoAssinatura({ status:'trial', valor_centavos:9000, trial_fim_em:amanha.toISOString() });
  assert.equal(resumo.valor_reais, 90);
  assert.equal(resumo.em_trial, true);
  assert.ok(resumo.dias_trial_restantes >= 1);
});

test('aceita Pix como forma padrão e valida cartão sem armazenar dados', () => {
  assert.deepEqual(validarFormaPagamento({ billingType:'PIX' }), { billingType:'PIX' });
  const pagamento = validarFormaPagamento({
    billingType:'CREDIT_CARD',
    creditCard:{ holderName:'Daniel', number:'4111 1111 1111 1111', expiryMonth:'9', expiryYear:'2030', ccv:'123' },
    creditCardHolderInfo:{ name:'Daniel', email:'daniel@example.com', cpfCnpj:'12345678901', postalCode:'01001000', addressNumber:'10', phone:'11999999999' },
  });
  assert.equal(pagamento.billingType, 'CREDIT_CARD');
  assert.equal(pagamento.creditCard.number, '4111111111111111');
  assert.equal(pagamento.creditCard.expiryMonth, '09');
});

test('cartão exige dados do cartão e do titular', () => {
  assert.throws(() => validarFormaPagamento({ billingType:'CREDIT_CARD', creditCard:{}, creditCardHolderInfo:{} }), /cartão/i);
});
