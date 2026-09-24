/**
 * Tela do plano: mostra trial, valor e aciona o backend para criar a assinatura no Asaas.
 */
import { useEffect, useState } from 'react';
import { requisicao } from './api';
import './Assinatura.css';

function statusTexto(assinatura) {
  if (!assinatura) return 'Carregando';
  if (assinatura.em_trial) return `Teste grátis — ${assinatura.dias_trial_restantes} dia(s) restantes`;
  if (assinatura.status === 'ativo') return 'Plano ativo';
  if (assinatura.status === 'pendente') return 'Pagamento pendente';
  return assinatura.status || 'Não iniciado';
}

export default function Assinatura({ podeEditar }) {
  const [assinatura, setAssinatura] = useState(null);
  const [configurado, setConfigurado] = useState(false);
  const [documentoObrigatorio, setDocumentoObrigatorio] = useState(false);
  const [documentoCobranca, setDocumentoCobranca] = useState('');
  const billingType = 'CREDIT_CARD';
  const [cartao, setCartao] = useState({ holderName:'', email:'', number:'', expiryMonth:'', expiryYear:'', ccv:'', cpfCnpj:'', postalCode:'', addressNumber:'', phone:'' });
  const [estado, setEstado] = useState({ carregando:true, processando:false, erro:'', sucesso:'' });

  async function carregar() {
    setEstado(e => ({ ...e, carregando:true, erro:'' }));
    try {
      const resposta = await requisicao('/assinatura');
      setAssinatura(resposta.assinatura); setConfigurado(resposta.configurado);
      setDocumentoObrigatorio(Boolean(resposta.documento_obrigatorio));
      setEstado(e => ({ ...e, carregando:false }));
    } catch (erro) { setEstado(e => ({ ...e, carregando:false, erro:erro.message })); }
  }
  useEffect(() => { carregar(); }, []);

  async function iniciar() {
    setEstado({ carregando:false, processando:true, erro:'', sucesso:'' });
    try {
      const cpfCnpj = documentoCobranca || (billingType === 'CREDIT_CARD' ? cartao.cpfCnpj : '');
      const body = {
        billingType:'CREDIT_CARD',
        cpfCnpj,
        creditCard: { holderName:cartao.holderName, number:cartao.number, expiryMonth:cartao.expiryMonth, expiryYear:cartao.expiryYear, ccv:cartao.ccv },
        creditCardHolderInfo: {
          name:cartao.holderName,
          email:cartao.email,
          cpfCnpj:cartao.cpfCnpj,
          postalCode:cartao.postalCode,
          addressNumber:cartao.addressNumber,
          phone:cartao.phone,
          mobilePhone:cartao.phone,
        },
      };
      const resposta = await requisicao('/assinatura/iniciar', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      setAssinatura(resposta.assinatura);
      setEstado({ carregando:false, processando:false, erro:'', sucesso:'Assinatura criada. As cobranças serão atualizadas automaticamente.' });
    } catch (erro) { setEstado({ carregando:false, processando:false, erro:erro.message, sucesso:'' }); }
  }

  const assinaturaConectada = Boolean(assinatura?.asaas_subscription_id);
  const faltaDocumento = documentoObrigatorio && !assinaturaConectada && !(documentoCobranca.trim() || (billingType === 'CREDIT_CARD' && cartao.cpfCnpj.trim()));

  return <section className="assinatura">
    <header><p>PLANO E COBRANÇA</p><h1>Meu plano</h1><span>{statusTexto(assinatura)}</span></header>
    {estado.erro && <p className="assinatura-alerta" role="alert">{estado.erro}</p>}
    {estado.sucesso && <p className="assinatura-sucesso" role="status">{estado.sucesso}</p>}
    {estado.carregando ? <p>Carregando plano…</p> : <div className="assinatura-card">
      <div><small>Plano</small><strong>Norden Pro</strong><p>15 dias grátis e depois cobrança mensal automática pelo Asaas.</p></div>
      <div><small>Valor</small><strong>R$ {Number(assinatura?.valor_reais || 110).toLocaleString('pt-BR', { minimumFractionDigits:2 })}/mês</strong><p>Valor inicial de lançamento.</p></div>
      <div><small>Próxima cobrança</small><strong>{assinatura?.proxima_cobranca_em ? new Date(`${assinatura.proxima_cobranca_em}T00:00:00`).toLocaleDateString('pt-BR') : 'Após o teste grátis'}</strong><p>Cartão recorrente conectado.</p></div>
      <fieldset className="formas-pagamento" disabled={assinaturaConectada}>
        <legend>Forma de pagamento</legend>
        <label className="selecionado"><input type="radio" name="billingType" checked readOnly /><span>Cartão de crédito</span><small>Cobrança recorrente no cartão. A Norden não salva o número do cartão.</small></label>
      </fieldset>
      {documentoObrigatorio && !assinaturaConectada && <p className="assinatura-info">No cartão, o CPF/CNPJ do titular também será usado para cadastrar o cliente no Asaas.</p>}
      {billingType === 'CREDIT_CARD' && !assinaturaConectada && <div className="cartao-form">
        <label>Nome no cartão<input required value={cartao.holderName} onChange={e=>setCartao({...cartao,holderName:e.target.value})} /></label>
        <label>E-mail do titular<input required type="email" value={cartao.email} onChange={e=>setCartao({...cartao,email:e.target.value})} /></label>
        <label>Número do cartão<input required inputMode="numeric" autoComplete="cc-number" value={cartao.number} onChange={e=>setCartao({...cartao,number:e.target.value})} /></label>
        <label>Mês<input required inputMode="numeric" autoComplete="cc-exp-month" placeholder="MM" value={cartao.expiryMonth} onChange={e=>setCartao({...cartao,expiryMonth:e.target.value})} /></label>
        <label>Ano<input required inputMode="numeric" autoComplete="cc-exp-year" placeholder="AAAA" value={cartao.expiryYear} onChange={e=>setCartao({...cartao,expiryYear:e.target.value})} /></label>
        <label>CVV<input required inputMode="numeric" autoComplete="cc-csc" value={cartao.ccv} onChange={e=>setCartao({...cartao,ccv:e.target.value})} /></label>
        <label>CPF/CNPJ do titular<input required inputMode="numeric" value={cartao.cpfCnpj} onChange={e=>setCartao({...cartao,cpfCnpj:e.target.value})} /></label>
        <label>CEP<input required inputMode="numeric" value={cartao.postalCode} onChange={e=>setCartao({...cartao,postalCode:e.target.value})} /></label>
        <label>Número do endereço<input required value={cartao.addressNumber} onChange={e=>setCartao({...cartao,addressNumber:e.target.value})} /></label>
        <label>Telefone<input required inputMode="tel" value={cartao.phone} onChange={e=>setCartao({...cartao,phone:e.target.value})} /></label>
      </div>}
      <button className="botao-principal" disabled={!podeEditar || !configurado || estado.processando || assinaturaConectada || faltaDocumento} onClick={iniciar}>
        {assinaturaConectada ? 'Assinatura conectada' : estado.processando ? 'Conectando…' : billingType === 'PIX' ? 'Ativar com Pix automático' : 'Ativar com cartão'}
      </button>
      {!configurado && <p className="assinatura-alerta">A cobrança ainda está sendo preparada. Tente novamente mais tarde ou fale com o suporte.</p>}
      {!podeEditar && <p className="assinatura-alerta">Somente administradores podem ativar ou alterar o plano.</p>}
    </div>}
  </section>;
}
