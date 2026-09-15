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
  const [estado, setEstado] = useState({ carregando:true, processando:false, erro:'', sucesso:'' });

  async function carregar() {
    setEstado(e => ({ ...e, carregando:true, erro:'' }));
    try {
      const resposta = await requisicao('/assinatura');
      setAssinatura(resposta.assinatura); setConfigurado(resposta.configurado);
      setEstado(e => ({ ...e, carregando:false }));
    } catch (erro) { setEstado(e => ({ ...e, carregando:false, erro:erro.message })); }
  }
  useEffect(() => { carregar(); }, []);

  async function iniciar() {
    setEstado({ carregando:false, processando:true, erro:'', sucesso:'' });
    try {
      const resposta = await requisicao('/assinatura/iniciar', { method:'POST' });
      setAssinatura(resposta.assinatura);
      setEstado({ carregando:false, processando:false, erro:'', sucesso:'Assinatura criada no Asaas. As cobranças serão acompanhadas pelo webhook.' });
    } catch (erro) { setEstado({ carregando:false, processando:false, erro:erro.message, sucesso:'' }); }
  }

  return <section className="assinatura">
    <header><p>PLANO E COBRANÇA</p><h1>Meu plano</h1><span>{statusTexto(assinatura)}</span></header>
    {estado.erro && <p className="assinatura-alerta" role="alert">{estado.erro}</p>}
    {estado.sucesso && <p className="assinatura-sucesso" role="status">{estado.sucesso}</p>}
    {estado.carregando ? <p>Carregando plano…</p> : <div className="assinatura-card">
      <div><small>Plano</small><strong>Norden Pro</strong><p>Primeiro mês grátis e depois cobrança mensal automática pelo Asaas.</p></div>
      <div><small>Valor</small><strong>R$ {Number(assinatura?.valor_reais || 90).toLocaleString('pt-BR', { minimumFractionDigits:2 })}/mês</strong><p>Valor inicial de lançamento.</p></div>
      <div><small>Próxima cobrança</small><strong>{assinatura?.proxima_cobranca_em ? new Date(`${assinatura.proxima_cobranca_em}T00:00:00`).toLocaleDateString('pt-BR') : 'Após o teste grátis'}</strong><p>O Asaas avisará o Norden quando o pagamento for confirmado.</p></div>
      <button className="botao-principal" disabled={!podeEditar || !configurado || estado.processando || Boolean(assinatura?.asaas_subscription_id)} onClick={iniciar}>
        {assinatura?.asaas_subscription_id ? 'Assinatura conectada' : estado.processando ? 'Conectando…' : 'Ativar assinatura no Asaas'}
      </button>
      {!configurado && <p className="assinatura-alerta">Configure ASAAS_API_KEY e ASAAS_BASE_URL no Render para ativar assinaturas reais.</p>}
      {!podeEditar && <p className="assinatura-alerta">Somente administradores podem ativar ou alterar o plano.</p>}
    </div>}
  </section>;
}
