const { validarId, erroHttp } = require('./projetos');

const tipos = new Set(['chapa', 'fita', 'dobradica', 'corredica', 'puxador', 'outro']);
const unidades = new Set(['m2', 'm', 'un']);

function texto(valor, nome, maximo) {
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > maximo) throw erroHttp(400, `${nome} inválido.`);
  return valor.trim();
}
function inteiro(valor, nome, maximo = 9_000_000_000_000) {
  if (!Number.isSafeInteger(valor) || valor < 0 || valor > maximo) throw erroHttp(400, `${nome} inválido.`);
  return valor;
}
function validarMaterial(body) {
  if (!tipos.has(body?.tipo)) throw erroHttp(400, 'Tipo de material inválido.');
  if (!unidades.has(body?.unidade_consumo)) throw erroHttp(400, 'Unidade de consumo inválida.');
  const rendimento = inteiro(body.rendimento_milesimos, 'Rendimento', 1_000_000_000);
  if (!rendimento) throw erroHttp(400, 'Rendimento inválido.');
  return { tipo: body.tipo, descricao: texto(body.descricao, 'Descrição', 200), fornecedor: texto(body.fornecedor, 'Fornecedor', 120),
    unidade_consumo: body.unidade_consumo, rendimento_milesimos: rendimento, preco_centavos: inteiro(body.preco_centavos, 'Preço'), ativo: body.ativo !== false };
}

function gerarConsumo(projeto) {
  const w = Number(projeto.largura_cm), h = Number(projeto.altura_cm), d = Number(projeto.profundidade_cm);
  if (![w, h, d].every(v => Number.isFinite(v) && v > 0)) throw erroHttp(400, 'Confirme largura, altura e profundidade antes de estimar.');
  const movel = `${projeto.movel || ''} ${projeto.detalhes || ''}`.toLowerCase();
  const gavetas = movel.match(/(\d+)\s*gaveta/)?.[1] ? Math.min(20, Number(movel.match(/(\d+)\s*gaveta/)[1])) : /gavet/.test(movel) ? 3 : 0;
  const portas = movel.match(/(\d+)\s*porta/)?.[1] ? Math.min(20, Number(movel.match(/(\d+)\s*porta/)[1])) : /arm[aá]rio|guarda.?roupa|gabinete/.test(movel) ? 2 : 0;
  const areaCaixa = (2*h*d + 2*w*d + w*h) / 10000;
  const areaInterna = (gavetas * (2*d*15 + 2*Math.max(10, w-6)*15 + Math.max(10, w-6)*Math.max(10, d-5)) + portas*w*h/Math.max(1, portas)) / 10000;
  const chapa = Math.round((areaCaixa + areaInterna) * 1.15 * 1000);
  const fita = Math.round(((4*w + 4*h + gavetas * 2 * Math.max(10, w-6) + portas * 2 * (w/Math.max(1, portas) + h)) / 100) * 1.1 * 1000);
  const consumo = [{ tipo: 'chapa', quantidade_milesimos: chapa }, { tipo: 'fita', quantidade_milesimos: fita }];
  if (gavetas) consumo.push({ tipo: 'corredica', quantidade_milesimos: gavetas * 1000 }, { tipo: 'puxador', quantidade_milesimos: gavetas * 1000 });
  if (portas) consumo.push({ tipo: 'dobradica', quantidade_milesimos: portas * (h > 120 ? 4 : 2) * 1000 }, { tipo: 'puxador', quantidade_milesimos: portas * 1000 });
  return { consumo, suposicoes: [`Chapas calculadas pela caixa externa, com 15% de perda.`, `Fita calculada pelas bordas principais, com 10% de perda.`,
    gavetas ? `${gavetas} gaveta(s) estimada(s).` : 'Nenhuma gaveta identificada.', portas ? `${portas} porta(s) estimada(s).` : 'Nenhuma porta identificada.'] };
}

function montarEstimativa(projeto, catalogo) {
  const { consumo, suposicoes } = gerarConsumo(projeto);
  const itens = [], faltantes = [];
  for (const necessidade of consumo) {
    const material = catalogo.find(m => m.tipo === necessidade.tipo && m.ativo);
    if (!material) { faltantes.push(necessidade.tipo); continue; }
    const pacotes = Math.ceil(necessidade.quantidade_milesimos / Number(material.rendimento_milesimos));
    itens.push({ catalogo_id: material.id, descricao: material.descricao, categoria: ['dobradica','corredica','puxador'].includes(material.tipo) ? 'ferragem' : 'material',
      quantidade_milesimos: pacotes * 1000, unidade: 'un', valor_unitario_centavos: Number(material.preco_centavos),
      consumo_estimado_milesimos: necessidade.quantidade_milesimos, unidade_consumo: material.unidade_consumo, fornecedor: material.fornecedor, atualizado_em: material.atualizado_em });
  }
  return { itens, faltantes: [...new Set(faltantes)], suposicoes, aviso: 'Estimativa de referência. Confirme plano de corte, estoque, frete e preços antes de enviar ao cliente.' };
}

function somenteLocal(req, res, next) {
  const origem = req.get('origin');
  if (!origem) return next();
  try { const url = new URL(origem); if (['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return next(); } catch { /* bloqueia */ }
  return res.status(403).json({ mensagem: 'O catálogo está disponível apenas pela aplicação local.' });
}

function registrarEstimativa(app, banco, rota) {
  app.use('/api/catalogo', somenteLocal);
  app.get('/api/catalogo', rota(async (req, res) => res.json({ materiais: (await banco.query('SELECT * FROM catalogo_materiais WHERE marcenaria_id=$1 ORDER BY ativo DESC, tipo, descricao, id', [req.marcenaria.id])).rows })));
  app.post('/api/catalogo', rota(async (req, res) => {
    const m = validarMaterial(req.body);
    const r = await banco.query(`INSERT INTO catalogo_materiais (tipo,descricao,fornecedor,unidade_consumo,rendimento_milesimos,preco_centavos,ativo,marcenaria_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [m.tipo,m.descricao,m.fornecedor,m.unidade_consumo,m.rendimento_milesimos,m.preco_centavos,m.ativo,req.marcenaria.id]);
    res.status(201).json({ material: r.rows[0] });
  }));
  app.put('/api/catalogo/:id', rota(async (req, res) => {
    const id = validarId(req.params.id), m = validarMaterial(req.body);
    const r = await banco.query(`UPDATE catalogo_materiais SET tipo=$1,descricao=$2,fornecedor=$3,unidade_consumo=$4,rendimento_milesimos=$5,
      preco_centavos=$6,ativo=$7,atualizado_em=CURRENT_TIMESTAMP WHERE id=$8 AND marcenaria_id=$9 RETURNING *`, [m.tipo,m.descricao,m.fornecedor,m.unidade_consumo,m.rendimento_milesimos,m.preco_centavos,m.ativo,id,req.marcenaria.id]);
    if (!r.rows[0]) throw erroHttp(404, 'Material não encontrado.'); res.json({ material: r.rows[0] });
  }));
  app.post('/api/projetos/:id/estimativa', rota(async (req, res) => {
    if((req.marcenaria.segmento || 'marcenaria') !== 'marcenaria') throw erroHttp(409,'A estimativa automática de materiais é exclusiva do ramo de marcenaria. Para este pedido, utilize o orçamento manual.');
    const id = validarId(req.params.id);
    const projeto = (await banco.query('SELECT * FROM projetos WHERE id=$1 AND marcenaria_id=$2', [id,req.marcenaria.id])).rows[0];
    if (!projeto) throw erroHttp(404, 'Projeto não encontrado.');
    const catalogo = (await banco.query('SELECT * FROM catalogo_materiais WHERE ativo=TRUE AND marcenaria_id=$1 ORDER BY atualizado_em DESC, id DESC', [req.marcenaria.id])).rows;
    res.json(montarEstimativa(projeto, catalogo));
  }));
}

module.exports = { registrarEstimativa, validarMaterial, gerarConsumo, montarEstimativa };
