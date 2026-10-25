const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomUUID, createHash } = require('node:crypto');
const pool = require('../database');
const { criarApp } = require('../server');
const { criarHashSenha } = require('../auth');

test('contas: correção preserva CPF, revoga links antigos e exclusão exige administrador e senha', { skip: !process.env.TEST_DATABASE }, async t => {
  const db = await pool.connect(); let server;
  try {
    await db.query('BEGIN');
    const banco = {
      query: (...args) => db.query(...args),
      connect: async () => ({ query: (sql, p) => db.query(({ BEGIN: 'SAVEPOINT conta', COMMIT: 'RELEASE SAVEPOINT conta', ROLLBACK: 'ROLLBACK TO SAVEPOINT conta' })[sql] || sql, p), release() {} }),
    };
    server = criarApp({ banco }).listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const senha = 'senha-de-teste-segura-123', tag = randomUUID();
    const errado = `errado-${tag}@example.com`, certo = `certo-${tag}@example.com`;
    const adminEmail = `admin-${tag}@example.com`;
    const hash = await criarHashSenha(senha);
    const admin = (await db.query('INSERT INTO usuarios(nome,email,senha_hash,superadministrador,email_confirmado) VALUES ($1,$2,$3,TRUE,TRUE) RETURNING id', ['Admin QA', adminEmail, hash])).rows[0];
    async function chamar(path, body, status = 200, sessao, method = 'POST') {
      const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(sessao ? { Cookie: sessao.cookie, 'X-CSRF-Token': sessao.csrf } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(body) });
      const data = await r.json(); assert.equal(r.status, status, JSON.stringify(data));
      return { ...data, cookie: r.headers.get('set-cookie')?.split(';')[0], csrf: data.csrf_token };
    }
    await chamar('/auth/cadastro', { nome: 'Pessoa QA', email: errado, senha, documento: '52998224725', empresa: `Empresa ${tag}`, segmento: 'servicos' }, 201);
    const usuario = (await db.query('SELECT id FROM usuarios WHERE email=$1', [errado])).rows[0];
    const empresa = (await db.query('SELECT marcenaria_id FROM membros_marcenaria WHERE usuario_id=$1', [usuario.id])).rows[0].marcenaria_id;
    const tokenAntigo = (await db.query('SELECT texto FROM emails_saida WHERE destinatario=$1', [errado])).rows[0].texto.match(/confirmar=([a-f0-9]+)/)[1];
    const correcao = { documento: '52998224725', senha, email: certo, email_confirmacao: certo };
    await t.test('rejeita senha errada, confirmação diferente e e-mail em uso sem alterar cadastro', async () => {
      await chamar('/auth/corrigir-email', { ...correcao, senha: 'senha-errada' }, 403);
      await chamar('/auth/corrigir-email', { ...correcao, email_confirmacao: errado }, 400);
      await chamar('/auth/corrigir-email', { ...correcao, email: adminEmail, email_confirmacao: adminEmail }, 409);
      assert.equal((await db.query('SELECT email FROM usuarios WHERE id=$1', [usuario.id])).rows[0].email, errado);
    });
    await t.test('corrige sem recriar a empresa e invalida o link anterior', async () => {
      await chamar('/auth/corrigir-email', correcao);
      assert.deepEqual((await db.query('SELECT email,documento,email_confirmado FROM usuarios WHERE id=$1', [usuario.id])).rows[0], { email: certo, documento: '52998224725', email_confirmado: false });
      assert.equal((await db.query('SELECT marcenaria_id FROM membros_marcenaria WHERE usuario_id=$1', [usuario.id])).rows[0].marcenaria_id, empresa);
      await chamar('/auth/confirmar-email', { token: tokenAntigo }, 400);
      await chamar('/auth/login', { identificador: certo, senha }, 403);
      await chamar('/auth/corrigir-email', correcao, 429);
      const texto = (await db.query('SELECT texto FROM emails_saida WHERE destinatario=$1', [certo])).rows[0].texto;
      const token = texto.match(/confirmar=([a-f0-9]+)/)[1];
      await chamar('/auth/confirmar-email', { token });
      await chamar('/auth/confirmar-email', { token }, 400);
      await chamar('/auth/corrigir-email', correcao, 403);
    });
    const comum = await chamar('/auth/login', { identificador: certo, senha });
    const administrativa = await chamar('/auth/login', { identificador: adminEmail, senha });
    await t.test('nega acesso anônimo, usuário comum e requisição sem CSRF', async () => {
      await chamar('/admin/usuarios', undefined, 401, undefined, 'GET');
      await chamar('/admin/usuarios', undefined, 403, comum, 'GET');
      await chamar(`/admin/usuarios/${usuario.id}`, { senha }, 403, comum, 'DELETE');
      const r = await fetch(base + `/admin/usuarios/${usuario.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Cookie: administrativa.cookie }, body: JSON.stringify({ senha }) });
      assert.equal(r.status, 403);
      await chamar(`/admin/usuarios/${usuario.id}`, { senha: 'errada' }, 403, administrativa, 'DELETE');
      await chamar(`/admin/usuarios/${admin.id}`, { senha }, 400, administrativa, 'DELETE');
      const outroAdmin = (await db.query('INSERT INTO usuarios(nome,email,senha_hash,superadministrador) VALUES ($1,$2,$3,TRUE) RETURNING id', ['Outro', `outro-${tag}@example.com`, hash])).rows[0];
      await chamar(`/admin/usuarios/${outroAdmin.id}`, { senha }, 403, administrativa, 'DELETE');
      const lista = await chamar(`/admin/usuarios?busca=${encodeURIComponent(certo)}`, undefined, 200, administrativa, 'GET');
      assert.equal(lista.usuarios.length, 1); assert.equal(lista.usuarios[0].senha_hash, undefined); assert.equal(lista.usuarios[0].documento, undefined);
    });
    await t.test('remove identidade, sessões, tokens e convites; libera documento e preserva empresa', async () => {
      await db.query('INSERT INTO convites_equipe(marcenaria_id,email,papel,token_hash,expira_em,criado_por) VALUES ($1,$2,$3,$4,NOW()+INTERVAL \'1 day\',$5)', [empresa, 'convidado@example.com', 'atendente', createHash('sha256').update(tag).digest('hex'), usuario.id]);
      await chamar(`/admin/usuarios/${usuario.id}`, { senha }, 200, administrativa, 'DELETE');
      for (const tabela of ['usuarios', 'sessoes', 'tokens_usuario', 'membros_marcenaria']) {
        const campo = tabela === 'usuarios' ? 'id' : 'usuario_id';
        assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${tabela} WHERE ${campo}=$1`, [usuario.id])).rows[0].n, 0);
      }
      assert.equal((await db.query('SELECT count(*)::int AS n FROM convites_equipe WHERE criado_por=$1', [usuario.id])).rows[0].n, 0);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM emails_saida WHERE destinatario=$1', [certo])).rows[0].n, 0);
      assert.equal((await db.query('SELECT id FROM marcenarias WHERE id=$1', [empresa])).rows[0].id, empresa);
      await chamar('/auth/sessao', undefined, 401, comum, 'GET');
      await chamar('/auth/login', { identificador: certo, senha }, 401);
      await chamar('/auth/cadastro', { nome: 'Pessoa QA', email: certo, senha, documento: '52998224725', empresa: `Nova ${tag}`, segmento: 'servicos' }, 201);
    });
    await t.test('limita tentativas de correção por endereço de rede', async () => {
      let bloqueado = false;
      for (let i = 0; i < 11; i++) {
        const r = await fetch(base + '/auth/corrigir-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...correcao, senha: 'incorreta' }) });
        if (r.status === 429) { assert.ok(Number(r.headers.get('retry-after')) > 0); bloqueado = true; break; }
        assert.equal(r.status, 403);
      }
      assert.equal(bloqueado, true);
    });
  } finally { if (server) await new Promise(r => server.close(r)); await db.query('ROLLBACK'); db.release(); await pool.end(); }
});
