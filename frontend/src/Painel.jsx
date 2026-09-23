/**
 * Tela de gestão: carrega clientes e projetos, filtra as listas, mostra a ficha selecionada e oferece as ações de lixeira e orçamento.
 */
import { useEffect, useRef, useState } from 'react';
import { requisicao } from './api';
import { categorias, filtrarProjetos, filtrarClientes, formatarData, formatarMedida } from './painel-utils';
import './Painel.css';
import Orcamento from './Orcamento';
import ConfirmarExclusao from './ConfirmarExclusao';

const porPagina = 12;
const vazio = { clientes: [], projetos: [], resumo: { clientes: 0, projetos: 0, em_coleta: 0, pendentes: 0, completos: 0 } };

export default function Painel({ visivel, segmento = 'marcenaria' }) {
  // Estados de exclusão/lixeira ficam separados dos dados principais para evitar apagar registros por engano.
  const [exclusaoPendente,setExclusaoPendente]=useState(null);
  const [lixeira, setLixeira] = useState([]);
  const [projetosExcluidos, setProjetosExcluidos] = useState([]);
  const [movendo, setMovendo] = useState(false);
  const [avisoCliente, setAvisoCliente] = useState('');
  const travaCliente = useRef(false);
  const [dados, setDados] = useState(vazio);
  const [estado, setEstado] = useState({ carregando: true, erro: '' });
  const [atualizacao, setAtualizacao] = useState(0);
  const [aba, setAba] = useState('projetos');
  const [busca, setBusca] = useState('');
  const [cliente, setCliente] = useState('');
  const [categoria, setCategoria] = useState('');
  const [pagina, setPagina] = useState(1);
  const [selecionado, setSelecionado] = useState(null);
  const [ficha, setFicha] = useState({ carregando: false, erro: '', dados: null });
  const tituloFicha = useRef(null);
  const origemFicha = useRef(null);

  useEffect(() => {
    // Ao abrir/atualizar o painel, carrega resumo, listas ativas e lixeiras em paralelo.
    if (!visivel) return;
    let cancelado = false;
    requisicao('/status').then(status => {
      if (!status.recursos?.includes('painel-v1')) throw new Error('O painel precisa do backend atualizado. Reinicie o backend com npm.cmd start e clique em Atualizar painel.');
      return Promise.all([requisicao('/painel'), requisicao('/clientes/lixeira'), requisicao('/projetos/lixeira')]);
    }).then(resultado => {
      if (!cancelado) { setDados(resultado[0]); setLixeira(resultado[1].clientes); setProjetosExcluidos(resultado[2].projetos); setEstado({ carregando: false, erro: '' }); }
    }).catch(erro => { if (!cancelado) setEstado({ carregando: false, erro: erro.message }); });
    return () => { cancelado = true; };
  }, [visivel, atualizacao]);

  useEffect(() => {
    // A ficha completa só é buscada quando o usuário escolhe um projeto, economizando chamadas na listagem.
    if (!selecionado || !visivel) return;
    let cancelado = false;
    requisicao(`/painel/projetos/${selecionado}`).then(resultado => {
      if (!cancelado) setFicha({ carregando: false, erro: '', dados: resultado });
    }).catch(erro => { if (!cancelado) setFicha({ carregando: false, erro: erro.message, dados: null }); });
    return () => { cancelado = true; };
  }, [selecionado, visivel, atualizacao]);

  useEffect(() => {
    // Quando a ficha abre, move o foco para o título para melhorar navegação por teclado/leitor de tela.
    if (selecionado && !ficha.carregando) tituloFicha.current?.focus();
  }, [selecionado, ficha.carregando]);

  function atualizar() {
    // Recarrega listas e, se houver ficha aberta, também força a ficha a buscar dados atuais.
    setEstado({ carregando: true, erro: '' });
    if (selecionado) setFicha({ carregando: true, erro: '', dados: null });
    setAtualizacao(v => v + 1);
  }

  function abrirFicha(id, elemento) {
    // Guarda o botão que abriu a ficha para devolver o foco ao fechar.
    origemFicha.current = elemento;
    setFicha({ carregando: true, erro: '', dados: null });
    if (selecionado === id) setAtualizacao(v => v + 1);
    setSelecionado(id);
  }

  function fecharFicha() {
    // Fecha a lateral de detalhes sem perder filtros nem página atual.
    setSelecionado(null);
    setFicha({ carregando: false, erro: '', dados: null });
    origemFicha.current?.focus();
  }

  // Filtros sempre voltam para a primeira página porque a lista resultante pode ficar menor.
  function filtrar(setter, valor) { setter(valor); setPagina(1); }
  function limpar() { setBusca(''); setCliente(''); setCategoria(''); setPagina(1); }
  function projetosDoCliente(id) { limpar(); setCliente(String(id)); setAba('projetos'); fecharFicha(); }

  async function moverCliente(item, restaurar = false) {
    // Arquivar cliente preserva projetos e mensagens; exclusão definitiva exige outro fluxo de confirmação.
    if (travaCliente.current || estado.carregando) return;
    if (!restaurar && !window.confirm(`Mover ${item.nome || item.telefone} para a lixeira? Os projetos, orçamentos e o histórico serão preservados e poderão ser recuperados.`)) return;
    travaCliente.current = true; setMovendo(true); setAvisoCliente('');
    try {
      const resultado = await requisicao(`/clientes/${item.id}${restaurar ? '/restaurar' : ''}`, { method: restaurar ? 'POST' : 'DELETE' });
      setAvisoCliente(resultado.mensagem); fecharFicha(); limpar(); atualizar();
      window.dispatchEvent(new Event('norden:clientes-alterados'));
    } catch (erro) { setEstado(anterior => ({ ...anterior, erro: erro.message })); }
    finally { travaCliente.current = false; setMovendo(false); }
  }

  const projetos = filtrarProjetos(dados.projetos, { busca, cliente, categoria });
  async function alterarRegistro(item, tipo, acao) {
    // Projetos e clientes compartilham a mesma lógica de restaurar, mover para lixeira ou confirmar exclusão final.
    if(travaCliente.current || estado.carregando) return;
    if(acao==='permanente') {
      setExclusaoPendente({item,tipo});return;
    } else if(acao==='excluir' && !window.confirm(`Mover o projeto #${item.id} (${item.movel || 'sem móvel informado'}) para a lixeira? Você poderá restaurá-lo depois.`)) return;
    travaCliente.current=true; setMovendo(true); setAvisoCliente('');
    try {
      const resultado=await requisicao(`/${tipo==='cliente'?'clientes':'projetos'}/${item.id}${acao==='excluir'?'':`/${acao}`}`,{
        method:acao==='restaurar'?'POST':'DELETE',
      });
      setAvisoCliente(resultado.mensagem);fecharFicha();limpar();atualizar();window.dispatchEvent(new Event('norden:clientes-alterados'));
    } catch(erro){setEstado(anterior=>({...anterior,erro:erro.message}));}
    finally{travaCliente.current=false;setMovendo(false);}
  }
  const mostrandoProjetos = aba === 'projetos' || aba === 'lixeira-projetos';
  const clientes = filtrarClientes(aba === 'lixeira' ? lixeira : dados.clientes, busca);
  const registros = aba === 'lixeira-projetos' ? filtrarProjetos(projetosExcluidos, { busca }) : aba === 'projetos' ? projetos : clientes;
  const totalPaginas = Math.max(1, Math.ceil(registros.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = registros.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);
  const p = ficha.dados?.projeto;

  return <main className="painel">
    {/* Confirmação com senha para exclusão permanente: evita remoção irreversível por clique acidental. */}
    {exclusaoPendente&&<ConfirmarExclusao alvo={exclusaoPendente} aoFechar={()=>setExclusaoPendente(null)} aoExcluir={mensagem=>{
      setExclusaoPendente(null);setAvisoCliente(mensagem);fecharFicha();limpar();atualizar();window.dispatchEvent(new Event('norden:clientes-alterados'));
    }}/>}
    <header className="painel-cabecalho">
      <div><p className="sobretitulo">Sua empresa, organizada</p><h1>Painel de projetos</h1>
        <p className="texto-suave">Clientes, dados coletados e conversas em um só lugar.</p></div>
      <button className="botao-secundario" disabled={estado.carregando} onClick={atualizar}>
        {estado.carregando ? 'Atualizando…' : 'Atualizar painel'}
      </button>
    </header>

    {estado.erro && <div className="aviso erro" role="alert">{estado.erro} <button onClick={atualizar}>Tentar novamente</button></div>}
    {avisoCliente && <p className="aviso sucesso" role="status">{avisoCliente}</p>}
    {/* Indicadores rápidos: números gerais da empresa sem considerar os filtros da tabela. */}
    <section className="indicadores" aria-label="Resumo geral, sem filtros">
      {[['Clientes', dados.resumo.clientes], ['Projetos', dados.resumo.projetos], ['Em coleta', dados.resumo.em_coleta],
        ['Confirmar dados', dados.resumo.pendentes], ['Dados completos', dados.resumo.completos]].map(([titulo, valor]) =>
        <div className="indicador" key={titulo}><span>{titulo}</span><strong>{estado.carregando && !dados.consultado_em ? '—' : valor}</strong></div>)}
    </section>
    <p className="nota">“Dados completos” significa coleta preenchida, não orçamento aprovado. {dados.consultado_em && `Consulta: ${formatarData(dados.consultado_em)}.`}</p>

    <div className={`painel-conteudo ${selecionado ? 'com-ficha' : ''}`}>
      {/* Lista principal: alterna entre projetos, clientes e lixeiras usando os mesmos filtros visuais. */}
      <section className="lista-painel" aria-label="Consulta de clientes e projetos" aria-busy={estado.carregando}>
        <div className="abas-lista" aria-label="Tipo de consulta">
          <button aria-pressed={aba === 'projetos'} onClick={() => { setAba('projetos'); setPagina(1); }}>Projetos</button>
          <button aria-pressed={aba === 'clientes'} onClick={() => { setAba('clientes'); setPagina(1); fecharFicha(); }}>Clientes</button>
          <button aria-pressed={aba === 'lixeira'} onClick={() => { setAba('lixeira'); limpar(); fecharFicha(); }}>Lixeira de clientes ({lixeira.length})</button>
          <button aria-pressed={aba === 'lixeira-projetos'} onClick={() => { setAba('lixeira-projetos'); limpar(); fecharFicha(); }}>Lixeira de projetos ({projetosExcluidos.length})</button>
        </div>
        {aba === 'lixeira' && <p className="contagem">Os clientes permanecem aqui até serem restaurados. Projetos, orçamentos e histórico são preservados. Não há exclusão automática.</p>}
        {aba === 'lixeira-projetos' && <p className="contagem">Restaure um projeto ou exclua-o permanentemente. Se o cliente também estiver na lixeira, restaure primeiro o cliente. Restaurar um cliente não restaura projetos excluídos separadamente.</p>}
        <div className="filtros">
          <label className="busca">Buscar<input type="search" value={busca} onChange={e => filtrar(setBusca, e.target.value)}
            placeholder={aba === 'projetos' ? 'Cliente, telefone ou pedido' : 'Nome ou telefone do cliente'} /></label>
          {aba === 'projetos' && <>
            <label>Cliente<select value={cliente} onChange={e => filtrar(setCliente, e.target.value)}>
              <option value="">Todos os clientes</option>
              {dados.clientes.map(c => <option value={c.id} key={c.id}>{c.nome || 'Sem nome'} · {c.telefone}</option>)}
            </select></label>
            <label>Situação da coleta<select value={categoria} onChange={e => filtrar(setCategoria, e.target.value)}>
              <option value="">Todas as situações</option>
              {Object.entries(categorias).map(([valor, nome]) => <option value={valor} key={valor}>{nome}</option>)}
            </select></label>
          </>}
          <button className="botao-texto" onClick={limpar}>Limpar filtros</button>
        </div>

        <p className="contagem" role="status">{estado.carregando ? 'Carregando dados…' : `${registros.length} ${aba === 'projetos' ? 'projeto(s)' : 'cliente(s)'}`}</p>
        {!estado.carregando && !registros.length && <div className="estado-vazio">
          <h2>{(busca || cliente || categoria) ? 'Nenhum resultado para esses filtros' : `Nenhum ${aba === 'projetos' ? 'projeto' : 'cliente'} cadastrado ainda`}</h2>
          <p>{(busca || cliente || categoria) ? 'Limpe os filtros ou tente outra busca.' : aba === 'lixeira' ? 'A lixeira está vazia.' : 'Os registros aparecerão aqui conforme os atendimentos forem iniciados.'}</p>
        </div>}
        {visiveis.length > 0 && <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Resultados da consulta. Deslize para ver todas as colunas."><table>
          <caption className="somente-leitor">{aba === 'projetos' ? 'Projetos cadastrados, ordenados por atualização' : 'Clientes cadastrados'}</caption>
          <thead><tr>{(mostrandoProjetos ? ['Projeto', 'Cliente', aba === 'lixeira-projetos' ? 'Situação do cliente' : 'Coleta', aba === 'lixeira-projetos' ? 'Excluído em' : 'Atualização', 'Ação'] : ['Cliente', 'Telefone', 'Projetos', aba === 'lixeira' ? 'Excluído em' : 'Última mensagem', 'Ação'])
            .map(nome => <th key={nome} scope="col">{nome}</th>)}</tr></thead>
          <tbody>{visiveis.map(item => mostrandoProjetos ? <tr key={item.id} className={selecionado === item.id ? 'selecionado' : ''}>
            <td><strong>{item.coleta?.geral?.solicitacao || item.movel || 'Pedido não informado'}</strong><small>#{item.id} · {item.coleta?.geral?.detalhes || item.uso || 'Solicitação'}</small></td>
            <td>{item.cliente_nome || 'Sem nome'}<small>{item.telefone}</small></td>
            <td>{aba==='lixeira-projetos' ? (item.cliente_excluido_em?'Cliente na lixeira':'Cliente ativo') : <><span className={`selo ${item.situacao.categoria}`}>{categorias[item.situacao.categoria]}</span>
              <small>{item.situacao.preenchidos}/{item.situacao.total_campos} campos principais</small></>}</td>
            <td className="data-coluna">{formatarData(aba==='lixeira-projetos'?item.excluido_em:item.atualizado_em)}</td>
            <td><div className="acoes-cliente">{aba==='lixeira-projetos'?<>
              <button className="botao-secundario" disabled={movendo||estado.carregando||Boolean(item.cliente_excluido_em)} onClick={()=>alterarRegistro(item,'projeto','restaurar')}>Restaurar</button>
              <button className="botao-excluir-cliente" disabled={movendo||estado.carregando} onClick={()=>alterarRegistro(item,'projeto','permanente')}>Excluir permanentemente</button>
            </>:<><button className="botao-secundario" aria-label={`Ver projeto ${item.id}`} onClick={e => abrirFicha(item.id, e.currentTarget)}>Ver ficha</button>
              <button className="botao-excluir-cliente" disabled={movendo||estado.carregando} onClick={()=>alterarRegistro(item,'projeto','excluir')} aria-label={`Mover projeto ${item.id} para a lixeira`}>Excluir</button></>}</div></td>
          </tr> : <tr key={item.id}>
            <td><strong>{item.nome || 'Nome não informado'}</strong><small>Cliente #{item.id}</small></td>
            <td>{item.telefone}</td><td>{item.total_projetos}</td>
            <td className="ultima-mensagem">{aba === 'lixeira' ? formatarData(item.excluido_em) : item.ultima_mensagem || 'Sem mensagens'}</td>
            <td><div className="acoes-cliente">{aba === 'lixeira'
              ? <><button className="botao-secundario" disabled={movendo || estado.carregando} onClick={() => moverCliente(item, true)} aria-label={`Restaurar cliente ${item.nome || item.telefone}`}>Restaurar</button><button className="botao-excluir-cliente" disabled={movendo||estado.carregando} onClick={()=>alterarRegistro(item,'cliente','permanente')}>Excluir permanentemente</button></>
              : <><button className="botao-secundario" onClick={() => projetosDoCliente(item.id)} aria-label={`Ver projetos do cliente ${item.id}`}>Ver projetos</button>
                <button className="botao-excluir-cliente" disabled={movendo || estado.carregando} onClick={() => moverCliente(item)} aria-label={`Mover cliente ${item.nome || item.telefone} para a lixeira`}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></svg>Excluir</button></>}
            </div></td>
          </tr>)}</tbody>
        </table></div>}
        {registros.length > 0 && <nav className="paginacao" aria-label="Paginação da consulta">
          <button disabled={paginaAtual <= 1} onClick={() => setPagina(paginaAtual - 1)}>Anterior</button>
          <span>Página {paginaAtual} de {totalPaginas}</span>
          <button disabled={paginaAtual >= totalPaginas} onClick={() => setPagina(paginaAtual + 1)}>Próxima</button>
        </nav>}
      </section>

      {/* Ficha lateral: concentra dados coletados, pendências, orçamento e histórico da conversa. */}
      {selecionado && <aside className="ficha-projeto" aria-labelledby="titulo-ficha" aria-busy={ficha.carregando}>
        <header><h2 ref={tituloFicha} tabIndex={-1} id="titulo-ficha">Projeto #{selecionado}</h2><button onClick={fecharFicha} aria-label="Fechar ficha">Fechar</button></header>
        {ficha.carregando && <p role="status">Carregando ficha e histórico…</p>}
        {ficha.erro && <div className="aviso erro" role="alert">{ficha.erro}<button onClick={atualizar}>Tentar novamente</button></div>}
        {p && <>
          <h3>{p.coleta?.geral?.solicitacao || p.movel || 'Pedido não informado'}</h3><p>{p.cliente_nome || 'Cliente sem nome'} · {p.telefone}</p>
          <span className={`selo ${p.situacao.categoria}`}>{categorias[p.situacao.categoria]}</span>
          <dl className="dados-ficha">
            {(p.coleta?.geral || segmento !== 'marcenaria' ? [['Solicitação', p.coleta?.geral?.solicitacao || 'Não informada'], ['Detalhes', p.coleta?.geral?.detalhes || 'Não informados']] : [['Ambiente', p.uso || 'Não informado'], ['Largura', formatarMedida(p.largura_cm)], ['Altura', formatarMedida(p.altura_cm)],
              ['Profundidade', formatarMedida(p.profundidade_cm)], ['Acabamento', p.acabamento || 'Não informado'],
              ['Detalhes', p.detalhes || 'Não informados']]).map(([nome, valor]) => <div key={nome}><dt>{nome}</dt><dd>{valor}</dd></div>)}
          </dl>
          {p.situacao.pendencias.length > 0 && <section className="aviso"><h3>Aguardando confirmação</h3><ul>{p.situacao.pendencias.map((texto, i) => <li key={i}>{texto}</li>)}</ul></section>}
          {p.situacao.faltantes.length > 0 && <p className="nota">Falta informar: {p.situacao.faltantes.join(', ')}.</p>}
          <p className="nota">Criado: {formatarData(p.criado_em)}<br />Atualizado: {formatarData(p.atualizado_em)}</p>
          <Orcamento key={p.id} projeto={p} aoSalvar={() => setAtualizacao(v => v + 1)} />
          <h3>Histórico da conversa</h3>
          {/* Balões do histórico: cliente à direita, Suzy à esquerda, para leitura parecida com chat. */}
          <div className="historico-painel historico-baloes">
            {!ficha.dados.mensagens.length && <p className="texto-suave">Este projeto ainda não tem mensagens.</p>}
            {ficha.dados.mensagens.map(m => <article className={`mensagem-painel balao-conversa ${m.remetente === 'cliente' ? 'do-cliente mensagem-cliente' : 'da-suzy mensagem-suzy'}`} key={m.id}>
              <header><strong>{m.remetente === 'cliente' ? 'Cliente' : 'Suzy'}</strong><time>{formatarData(m.criado_em)}</time></header><p>{m.texto}</p>
            </article>)}
          </div>
        </>}
      </aside>}
    </div>
  </main>;
}
