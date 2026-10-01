/** Entrega os feedbacks de desconexão somente ao superadministrador da Norden. */
const { erroHttp } = require('./projetos');

function registrarFeedbackAdmin(app, banco, rota) {
  app.get('/api/admin/feedback-desconexao', rota(async (req,res) => {
    if (!req.usuario?.superadministrador) throw erroHttp(403, 'Este espaço é exclusivo da administração da Norden.');
    const feedbacks = (await banco.query(`SELECT d.id,d.motivo,d.criado_em,m.nome AS empresa
      FROM whatsapp_desconexoes d JOIN marcenarias m ON m.id=d.marcenaria_id
      ORDER BY d.criado_em DESC LIMIT 200`)).rows;
    res.json({ feedbacks });
  }));
}
module.exports = { registrarFeedbackAdmin };
