/** Configura o negócio antes do primeiro cliente, sempre dentro da empresa autenticada. */
const { erroHttp } = require('./projetos');
const { validarSegmento } = require('./segmentos');
function validarConfiguracao(body = {}) {
  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  const atividade = typeof body.atividade === 'string' ? body.atividade.trim() : '';
  if (!nome || nome.length > 120) throw erroHttp(400, 'Informe o nome da empresa (até 120 caracteres).');
  if (!atividade || atividade.length > 200) throw erroHttp(400, 'Conte com o que sua empresa trabalha (até 200 caracteres).');
  return { nome, atividade, segmento: validarSegmento(body.segmento) };
}
function registrarConfiguracaoEmpresa(app, banco, rota) {
  app.get('/api/empresa-configuracao', rota(async (req, res) => {
    const empresa = (await banco.query('SELECT id,nome,segmento,atividade,configurada_em FROM marcenarias WHERE id=$1', [req.marcenaria.id])).rows[0];
    if (!empresa) throw erroHttp(404, 'Empresa não encontrada.');
    res.json({ empresa });
  }));
  app.put('/api/empresa-configuracao', rota(async (req, res) => {
    if (!['proprietario', 'administrador', 'superadministrador'].includes(req.marcenaria.papel)) throw erroHttp(403, 'Somente administradores podem configurar a empresa.');
    const dados = validarConfiguracao(req.body);
    const db = await banco.connect();
    try {
      await db.query('BEGIN');
      const atual = (await db.query('SELECT segmento FROM marcenarias WHERE id=$1 FOR UPDATE', [req.marcenaria.id])).rows[0];
      if (!atual) throw erroHttp(404, 'Empresa não encontrada.');
      // Os projetos antigos usam o ramo da empresa; evita reinterpretar uma coleta já salva.
      if (atual.segmento !== dados.segmento && (await db.query('SELECT EXISTS (SELECT 1 FROM projetos WHERE marcenaria_id=$1) AS existe', [req.marcenaria.id])).rows[0].existe) {
        throw erroHttp(409, 'Esta empresa já tem projetos. Para trabalhar em outro ramo, crie uma nova empresa; os projetos atuais serão preservados.');
      }
      const empresa = (await db.query('UPDATE marcenarias SET nome=$1,segmento=$2,atividade=$3,configurada_em=COALESCE(configurada_em,NOW()) WHERE id=$4 RETURNING id,nome,segmento,atividade,configurada_em', [dados.nome,dados.segmento,dados.atividade,req.marcenaria.id])).rows[0];
      await db.query('COMMIT');
      res.json({ empresa });
    } catch (erro) { await db.query('ROLLBACK'); throw erro; } finally { db.release(); }
  }));
}
module.exports = { registrarConfiguracaoEmpresa, validarConfiguracao };
