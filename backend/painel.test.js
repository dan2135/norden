const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { situacaoColeta, resumoPainel } = require('./painel');
const { criarApp } = require('./server');
const pool = require('./database');

const completo = { movel: 'Mesa', uso: 'Sala', largura_cm: '120.00', altura_cm: 80, profundidade_cm: 60, acabamento: 'Branco', cliente_nome: 'Daniel', coleta: {} };

test('coleta completa não exige detalhes opcionais nem altera status do projeto', () => {
  const p = { ...completo, status: 'coletando_dados' };
  assert.deepEqual(situacaoColeta(p), { categoria: 'completo', faltantes: [], pendencias: [], preenchidos: 7, total_campos: 7 });
  assert.equal(p.status, 'coletando_dados');
});
test('pendência tem prioridade sobre campos completos', () => {
  const s = situacaoColeta({ ...completo, coleta: { medidas: { altura_cm: '90' }, duvidas: ['acabamento'] } });
  assert.equal(s.categoria, 'pendente');
  assert.equal(s.pendencias.length, 2);
  assert.match(s.pendencias[0], /90.*confirmar unidade/);
});
test('campos ausentes, sem nome e medidas inválidas aparecem como incompletos', () => {
  const s = situacaoColeta({ ...completo, cliente_nome: null, largura_cm: 0, uso: '  ' });
  assert.equal(s.categoria, 'em_coleta');
  assert.deepEqual(s.faltantes, ['Ambiente', 'Largura', 'Nome do cliente']);
  assert.equal(s.preenchidos, 4);
});
test('coleta antiga ou malformada não derruba o painel', () => {
  for (const coleta of [null, {}, { medidas: [], duvidas: 'texto' }]) assert.equal(situacaoColeta({ ...completo, coleta }).categoria, 'completo');
});
test('resumo inclui cliente sem projeto e categorias são exclusivas', () => {
  const projetos = [completo, {}, { ...completo, coleta: { medidas: { largura_cm: 120 } } }].map(p => ({ situacao: situacaoColeta(p) }));
  assert.deepEqual(resumoPainel([{}, {}], projetos), { clientes: 2, projetos: 3, em_coleta: 1, pendentes: 1, completos: 1 });
});

test('API do painel: listas, cliente sem projeto, ficha isolada, erros e somente leitura', { skip: !process.env.TEST_DATABASE }, async () => {
  const db = await pool.connect();
  let server;
  try {
    await db.query('BEGIN');
    const marcenariaId = (await db.query("SELECT id FROM marcenarias WHERE slug='principal'")).rows[0].id;
    const base = Date.now().toString();
    const c1 = (await db.query('INSERT INTO clientes (nome, telefone,marcenaria_id) VALUES ($1, $2,$3) RETURNING *', ['Teste Painel', '997' + base.slice(-12),marcenariaId])).rows[0];
    const c2 = (await db.query('INSERT INTO clientes (telefone,marcenaria_id) VALUES ($1,$2) RETURNING *', ['996' + base.slice(-12),marcenariaId])).rows[0];
    const p1 = (await db.query(`INSERT INTO projetos (cliente_id,movel,uso,largura_cm,altura_cm,profundidade_cm,acabamento,marcenaria_id)
      VALUES ($1,'Mesa','Sala',120,80,60,'Branco',$2) RETURNING *`, [c1.id,marcenariaId])).rows[0];
    const p2 = (await db.query(`INSERT INTO projetos (cliente_id,movel,coleta,marcenaria_id) VALUES ($1,'Gaveteiro',$2::jsonb,$3) RETURNING *`,
      [c1.id, JSON.stringify({ medidas: { altura_cm: '80' } }),marcenariaId])).rows[0];
    await db.query('INSERT INTO mensagens (cliente_id,projeto_id,remetente,texto,marcenaria_id) VALUES ($1,$2,$3,$4,$5)', [c1.id,p1.id,'cliente','Somente na mesa',marcenariaId]);
    await db.query('INSERT INTO mensagens (cliente_id,projeto_id,remetente,texto,marcenaria_id) VALUES ($1,$2,$3,$4,$5)', [c1.id,p2.id,'cliente','Somente no gaveteiro',marcenariaId]);
    const antes = (await db.query('SELECT * FROM projetos WHERE cliente_id=$1 ORDER BY id', [c1.id])).rows;
    server = criarApp({ banco: { query: (...args) => db.query(...args) } }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/api`;
    async function get(path, status = 200) {
      const resposta = await fetch(url + path);
      const data = await resposta.json();
      assert.equal(resposta.status, status, JSON.stringify(data));
      return data;
    }
    const painel = await get('/painel');
    for (const origin of ['https://example.com', 'http://localhost.example.com', 'null']) {
      const bloqueado = await fetch(url + '/painel', { headers: { origin } });
      assert.equal(bloqueado.status, 403);
      assert.match((await bloqueado.json()).mensagem, /aplicação local/);
    }
    const local = await fetch(url + '/painel', { headers: { origin: 'http://localhost:5173' } });
    assert.equal(local.status, 200);
    const cliente = painel.clientes.find(c => c.id === c1.id);
    assert.equal(cliente.total_projetos, 2);
    assert.equal(painel.clientes.find(c => c.id === c2.id).total_projetos, 0);
    assert.equal(painel.projetos.find(p => p.id === p1.id).situacao.categoria, 'completo');
    assert.equal(painel.projetos.find(p => p.id === p2.id).situacao.categoria, 'pendente');
    assert.equal(painel.resumo.projetos, painel.projetos.length);
    assert.equal(painel.resumo.clientes, painel.clientes.length);
    assert.equal(painel.resumo.em_coleta + painel.resumo.pendentes + painel.resumo.completos, painel.resumo.projetos);
    const ficha = await get(`/painel/projetos/${p1.id}`);
    assert.equal(ficha.projeto.cliente_nome, 'Teste Painel');
    assert.equal(ficha.mensagens.length, 1);
    assert.equal(ficha.mensagens[0].texto, 'Somente na mesa');
    await get('/painel/projetos/invalido', 400);
    await get('/painel/projetos/2147483647', 404);
    const depois = (await db.query('SELECT * FROM projetos WHERE cliente_id=$1 ORDER BY id', [c1.id])).rows;
    assert.deepEqual(depois, antes);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.query('ROLLBACK');
    db.release();
    await pool.end();
  }
});
