/** Área independente de clientes/projetos: perfil do negócio e catálogo compartilhado. */
import { useEffect, useState } from 'react';
import { requisicao } from './api';
import CatalogoEstimativa from './CatalogoEstimativa';
import './Orcamento.css';
import './ConfiguracaoEmpresa.css';

const ramos = [
  ['outros', 'Outros ramos'],
  ['serralheria', 'Serralheria e solda'],
  ['comercio', 'Comércio'],
  ['servicos', 'Prestação de serviços'],
  ['marcenaria', 'Marcenaria'],
];
const exemplosAtividade = {
  marcenaria: 'Ex.: móveis planejados, reformas, fabricação sob medida…',
  serralheria: 'Ex.: portões, grades, solda, estruturas metálicas…',
  comercio: 'Ex.: venda de peças, loja de materiais, comércio local…',
  servicos: 'Ex.: manutenção, instalação, reparos, assistência técnica…',
  outros: 'Ex.: serralheria, comércio, manutenção, instalação, produção sob medida…',
};
const whatsappInicial = { numero: '', waba_id: '', phone_number_id: '', access_token: '', api_version: 'v25.0', ativo: true, configurado: false };

export default function ConfiguracaoEmpresa({ aoSalvar, podeEditar }) {
  const [empresa, setEmpresa] = useState(null);
  const [whatsapp, setWhatsapp] = useState(whatsappInicial);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [erroWhatsApp, setErroWhatsApp] = useState('');
  const [sucessoWhatsApp, setSucessoWhatsApp] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [salvandoWhatsApp, setSalvandoWhatsApp] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [ramosPersonalizados, setRamosPersonalizados] = useState([]);
  useEffect(() => {
    let cancelado = false;
    requisicao('/empresa-configuracao').then(({empresa}) => { if (!cancelado) setEmpresa(empresa); }).catch(e => { if (!cancelado) setErro(e.message); });
    return () => { cancelado = true; };
  }, [tentativa]);
  useEffect(() => {
    requisicao('/ramos-personalizados').then(({ ramos }) => setRamosPersonalizados(ramos || [])).catch(() => {});
  }, []);
  useEffect(() => {
    requisicao('/whatsapp-configuracao').then(({ whatsapp }) => setWhatsapp({ ...whatsappInicial, ...whatsapp, access_token: '' })).catch(() => {});
  }, [tentativa]);
  async function salvar(e) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true); setErro(''); setSucesso('');
    try {
      const resultado = await requisicao('/empresa-configuracao', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(empresa) });
      setEmpresa(resultado.empresa); aoSalvar(resultado.empresa); setSucesso('Empresa configurada. Você já pode preparar os materiais abaixo e iniciar suas conversas.');
    } catch (erro) { setErro(erro.message); } finally { setOcupado(false); }
  }
  async function salvarWhatsApp(e) {
    e.preventDefault();
    if (salvandoWhatsApp) return;
    setSalvandoWhatsApp(true); setErroWhatsApp(''); setSucessoWhatsApp('');
    try {
      const resultado = await requisicao('/whatsapp-configuracao', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(whatsapp) });
      setWhatsapp({ ...whatsappInicial, ...resultado.whatsapp, access_token: '' });
      setSucessoWhatsApp('WhatsApp conectado a esta empresa. O webhook vai direcionar as mensagens deste número para este painel.');
    } catch (erro) { setErroWhatsApp(erro.message); } finally { setSalvandoWhatsApp(false); }
  }
  const webhookUrl = `${window.location.origin}/api/webhooks/whatsapp`;
  return <section className="configuracao-empresa">
    <header><p>SEU NEGÓCIO, DO SEU JEITO</p><h1>Minha empresa</h1><p>Defina com o que você trabalha e deixe seus materiais prontos antes da primeira conversa.</p></header>
    {erro && <p role="alert">{erro}</p>}
    {!empresa && (erro ? <button onClick={() => { setErro(''); setTentativa(v=>v+1); }}>Tentar novamente</button> : <p>Carregando configurações…</p>)}
    {empresa && <>
      {!empresa.configurada_em && <p className="configuracao-boas-vindas">Vamos preparar sua empresa? Revise o ramo de atividade, salve seu perfil e cadastre os materiais que usa. Você pode voltar aqui sempre que precisar.</p>}
      <form onSubmit={salvar}>
        <fieldset disabled={ocupado || !podeEditar}>
          <legend>Perfil da empresa</legend>
          <label>Nome da empresa<input required maxLength={120} value={empresa.nome} onChange={e=>setEmpresa({...empresa,nome:e.target.value})}/></label>
          <label>Ramo de atividade<select value={empresa.segmento} onChange={e=>setEmpresa({...empresa,segmento:e.target.value})}>{ramos.map(([valor,nome])=><option key={valor} value={valor}>{nome}</option>)}</select></label>
          <label>{empresa.segmento === 'outros' ? 'Qual é o ramo da sua empresa?' : 'Com o que você trabalha?'}<input required maxLength={200} list={empresa.segmento === 'outros' ? 'ramos-personalizados-configuracao' : undefined} placeholder={exemplosAtividade[empresa.segmento] || exemplosAtividade.outros} value={empresa.atividade} onChange={e=>setEmpresa({...empresa,atividade:e.target.value})}/></label>
          {empresa.segmento === 'outros' && <><datalist id="ramos-personalizados-configuracao">{ramosPersonalizados.map(r=><option key={r.chave} value={r.nome} />)}</datalist>{ramosPersonalizados.length>0 && <div className="sugestoes-ramos"><span>Já cadastrados:</span>{ramosPersonalizados.slice(0,6).map(r=><button type="button" key={r.chave} onClick={()=>setEmpresa({...empresa,segmento:'outros',atividade:r.nome})}>{r.nome}</button>)}</div>}</>}
          <button type="submit">{ocupado ? 'Salvando…' : 'Salvar perfil da empresa'}</button>
        </fieldset>
        {!podeEditar && <p>Peça ao administrador da empresa para alterar o perfil.</p>}
      </form>
      {sucesso && <p role="status">{sucesso}</p>}
      <form onSubmit={salvarWhatsApp}>
        <fieldset disabled={salvandoWhatsApp || !podeEditar}>
          <legend>WhatsApp da empresa</legend>
          <p>Conecte o número desta empresa na Meta. O mesmo webhook pode atender várias empresas; a Norden identifica pelo Phone Number ID.</p>
          <label>Número do WhatsApp<input maxLength={30} placeholder="+55 11 99999-9999" value={whatsapp.numero || ''} onChange={e=>setWhatsapp({...whatsapp,numero:e.target.value})}/></label>
          <label>Phone Number ID<input required inputMode="numeric" maxLength={40} placeholder="ID do número na Meta" value={whatsapp.phone_number_id || ''} onChange={e=>setWhatsapp({...whatsapp,phone_number_id:e.target.value})}/></label>
          <label>WhatsApp Business Account ID<input inputMode="numeric" maxLength={40} placeholder="WABA ID, se tiver" value={whatsapp.waba_id || ''} onChange={e=>setWhatsapp({...whatsapp,waba_id:e.target.value})}/></label>
          <label>Token de acesso da Meta<input type="password" autoComplete="off" maxLength={5000} placeholder={whatsapp.configurado ? 'Token já salvo; preencha só se quiser trocar' : 'Cole o token gerado na Meta'} value={whatsapp.access_token || ''} onChange={e=>setWhatsapp({...whatsapp,access_token:e.target.value})}/></label>
          <label>Versão da API<input required maxLength={10} value={whatsapp.api_version || 'v25.0'} onChange={e=>setWhatsapp({...whatsapp,api_version:e.target.value})}/></label>
          <label className="checkbox-config"><input type="checkbox" checked={whatsapp.ativo !== false} onChange={e=>setWhatsapp({...whatsapp,ativo:e.target.checked})}/> Atendimento ativo neste WhatsApp</label>
          <p className="nota-whatsapp">Webhook na Meta: <code>{webhookUrl}</code>. Token de verificação: <code>norden_whatsapp_2026</code>.</p>
          <button type="submit">{salvandoWhatsApp ? 'Salvando…' : whatsapp.configurado ? 'Atualizar WhatsApp' : 'Salvar WhatsApp'}</button>
        </fieldset>
        {!podeEditar && <p>Peça ao administrador da empresa para configurar o WhatsApp.</p>}
      </form>
      {erroWhatsApp && <p role="alert">{erroWhatsApp}</p>}
      {sucessoWhatsApp && <p role="status">{sucessoWhatsApp}</p>}
      <CatalogoEstimativa somenteCatalogo somenteLeitura={!podeEditar} segmento={empresa.segmento} atividade={empresa.atividade} />
    </>}
  </section>;
}
