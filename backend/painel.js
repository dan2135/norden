/**
 * Entrega listas, indicadores e fichas de projeto ao painel. O estado da coleta é calculado a partir das informações existentes e das pendências.
 */
const { validarId, erroHttp, historicoProjeto } = require('./projetos');

const campos = {
  movel: 'Móvel', uso: 'Ambiente', largura_cm: 'Largura', altura_cm: 'Altura',
  profundidade_cm: 'Profundidade', acabamento: 'Acabamento', cliente_nome: 'Nome do cliente',
};

// Classifica o projeto pelo que falta coletar ou confirmar, sem gravar essa classificação.
function situacaoColeta(projeto) {
  if (projeto.coleta?.geral || (projeto.segmento && projeto.segmento !== 'marcenaria')) {
    const faltantes = [['Solicitação', projeto.coleta?.geral?.solicitacao], ['Detalhes', projeto.coleta?.geral?.detalhes], ['Nome do cliente', projeto.cliente_nome]].filter(([,v])=>!v?.trim()).map(([k])=>k);
    return {categoria:faltantes.length?'em_coleta':'completo',faltantes,pendencias:[],preenchidos:3-faltantes.length,total_campos:3};
  }
  const faltantes = Object.entries(campos).filter(([campo]) => {
    const valor = projeto[campo];
    return campo.endsWith('_cm') ? !(Number(valor) > 0 && Number.isFinite(Number(valor)))
      : typeof valor !== 'string' || !valor.trim();
  }).map(([, nome]) => nome);
  const medidas = projeto.coleta?.medidas;
  const duvidas = projeto.coleta?.duvidas;
  const pendencias = [
    ...Object.entries(medidas && typeof medidas === 'object' && !Array.isArray(medidas) ? medidas : {})
      .filter(([campo]) => ['largura_cm', 'altura_cm', 'profundidade_cm'].includes(campo))
      .map(([campo, valor]) => `${campos[campo]}: ${valor} — confirmar unidade`),
    ...(Array.isArray(duvidas) ? duvidas : []).map(campo => `Confirmar ${campos[campo] || 'informação da coleta'}`),
  ];
  return {
    categoria: pendencias.length ? 'pendente' : faltantes.length ? 'em_coleta' : 'completo',
    faltantes, pendencias, preenchidos: Object.keys(campos).length - faltantes.length, total_campos: Object.keys(campos).length,
  };
}

// Conta clientes e categorias dos projetos para os indicadores do painel.
function resumoPainel(clientes, projetos) {
  return {
    clientes: clientes.length, projetos: projetos.length,
    em_coleta: projetos.filter(p => p.situacao.categoria === 'em_coleta').length,
    pendentes: projetos.filter(p => p.situacao.categoria === 'pendente').length,
    completos: projetos.filter(p => p.situacao.categoria === 'completo').length,
  };
}

// Registra as rotas de leitura das listas e da ficha de projeto.
function registrarPainel(app, banco, rota) {
  app.use('/api/painel', require('./seguranca').protegerOrigemPainel);
  app.get('/api/painel', rota(async (req, res) => {
    const resultado = await banco.query(`
      SELECT c.id AS cliente_id, c.nome AS cliente_nome, c.telefone,
        c.ultima_mensagem, c.status AS cliente_status,
        p.id AS projeto_id, p.movel, p.uso, p.largura_cm, p.altura_cm,
        p.profundidade_cm, p.acabamento, p.detalhes, p.status, p.coleta,
        p.criado_em, p.atualizado_em
      FROM clientes c LEFT JOIN projetos p ON p.cliente_id = c.id AND p.marcenaria_id=$1 AND p.excluido_em IS NULL
      WHERE c.marcenaria_id=$1 AND c.excluido_em IS NULL
      ORDER BY p.atualizado_em DESC NULLS LAST, p.id DESC, c.id DESC
    `, [req.marcenaria.id]);
    const porCliente = new Map();
    const projetos = [];
    for (const row of resultado.rows) {
      row.segmento = req.marcenaria.segmento || 'marcenaria';
      if (!porCliente.has(row.cliente_id)) porCliente.set(row.cliente_id, {
        id: row.cliente_id, nome: row.cliente_nome, telefone: row.telefone,
        ultima_mensagem: row.ultima_mensagem, status: row.cliente_status, total_projetos: 0,
      });
      if (row.projeto_id !== null) {
        const { projeto_id, ultima_mensagem, cliente_status, ...dados } = row;
        void ultima_mensagem; void cliente_status;
        const projeto = { ...dados, id: projeto_id, situacao: situacaoColeta(row) };
        projetos.push(projeto);
        porCliente.get(row.cliente_id).total_projetos++;
      }
    }
    const clientes = [...porCliente.values()].sort((a, b) => b.id - a.id);
    res.json({ clientes, projetos, resumo: resumoPainel(clientes, projetos), consultado_em: new Date().toISOString() });
  }));

  app.get('/api/painel/projetos/:id', rota(async (req, res) => {
    const id = validarId(req.params.id);
    const resultado = await banco.query(`SELECT p.*, c.nome AS cliente_nome, c.telefone
      FROM projetos p JOIN clientes c ON c.id = p.cliente_id
      WHERE p.id = $1 AND p.marcenaria_id=$2 AND c.marcenaria_id=$2`, [id,req.marcenaria.id]);
    const projeto = resultado.rows[0];
    if (!projeto) throw erroHttp(404, 'Projeto não encontrado.');
    projeto.segmento = req.marcenaria.segmento || 'marcenaria';
    res.json({ projeto: { ...projeto, situacao: situacaoColeta(projeto) },
      mensagens: await historicoProjeto(banco, projeto.cliente_id, projeto.id,req.marcenaria.id) });
  }));
}

module.exports = { registrarPainel, situacaoColeta, resumoPainel };
