const { validarSegmento } = require('./segmentos');
const { erroHttp, validarId } = require('./projetos');

function slugify(nome) {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
}

async function resolverMarcenaria(req, res, next, banco) {
  try {
    const informado = req.get('x-marcenaria-id');
    if (!informado) throw erroHttp(400, 'Selecione uma marcenaria para continuar.');
    const resultado = req.usuario.superadministrador
      ? await banco.query(`SELECT id,nome,slug,segmento,'superadministrador' AS papel FROM marcenarias WHERE id=$1 AND ativa=TRUE`, [validarId(informado)])
      : await banco.query(`SELECT m.id,m.nome,m.slug,m.segmento,mm.papel FROM marcenarias m
      JOIN membros_marcenaria mm ON mm.marcenaria_id=m.id
      WHERE m.id=$1 AND mm.usuario_id=$2 AND m.ativa=TRUE AND mm.ativo=TRUE`, [validarId(informado),req.usuario.id]);
    if (!resultado.rows[0]) throw erroHttp(404, 'Marcenaria não encontrada ou inativa.');
    req.marcenaria = resultado.rows[0];
    next();
  } catch (erro) { next(erro); }
}

function registrarMarcenarias(app, banco, rota) {
  app.get('/api/marcenarias', rota(async (req, res) => {
    const resultado = req.usuario.superadministrador
      ? await banco.query("SELECT id,nome,slug,segmento,'superadministrador' AS papel FROM marcenarias WHERE ativa=TRUE ORDER BY nome,id")
      : await banco.query(`SELECT m.id,m.nome,m.slug,m.segmento,mm.papel FROM membros_marcenaria mm
      JOIN marcenarias m ON m.id=mm.marcenaria_id WHERE mm.usuario_id=$1 AND mm.ativo=TRUE AND m.ativa=TRUE ORDER BY m.nome,m.id`, [req.usuario.id]);
    res.json({ marcenarias: resultado.rows });
  }));
  app.post('/api/marcenarias', rota(async (req, res) => {
    const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
    if (!nome || nome.length > 120) throw erroHttp(400, 'Informe um nome de até 120 caracteres.');
    const segmento = validarSegmento(req.body?.segmento);
    const base = slugify(nome);
    if (!base) throw erroHttp(400, 'Nome inválido.');
    const db = await banco.connect();
    try {
      await db.query('BEGIN');
      let criada;
      for (let i=0; i<20 && !criada; i++) {
        const slug = i ? `${base}-${i+1}` : base;
        criada = (await db.query('INSERT INTO marcenarias (nome,slug,segmento) VALUES ($1,$2,$3) ON CONFLICT (slug) DO NOTHING RETURNING id,nome,slug,segmento', [nome,slug,segmento])).rows[0];
      }
      if (!criada) throw erroHttp(409, 'Já existem muitas marcenarias com esse nome.');
      await db.query("INSERT INTO membros_marcenaria (usuario_id,marcenaria_id,papel) VALUES ($1,$2,'proprietario')", [req.usuario.id,criada.id]);
      await db.query('COMMIT');
      res.status(201).json({ marcenaria: { ...criada, papel: 'proprietario' } });
    } catch (erro) { await db.query('ROLLBACK'); throw erro; } finally { db.release(); }
  }));
}

module.exports = { registrarMarcenarias, resolverMarcenaria, slugify };
