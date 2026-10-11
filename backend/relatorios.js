/** Indicadores mensais simples, sempre limitados à empresa ativa. */
function registrarRelatorios(app, banco, rota) {
  app.get('/api/relatorios/mensal', rota(async (req, res) => {
    const resultado = await banco.query(`
      SELECT
        (SELECT COUNT(*) FROM mensagens m WHERE m.marcenaria_id=$1 AND m.remetente IN ('cliente','usuario') AND m.criado_em >= date_trunc('month', CURRENT_TIMESTAMP))::int AS atendimentos,
        (SELECT COUNT(*) FROM projetos p WHERE p.marcenaria_id=$1 AND p.criado_em >= date_trunc('month', CURRENT_TIMESTAMP))::int AS projetos,
        (SELECT COUNT(*) FROM projetos p WHERE p.marcenaria_id=$1 AND p.atendimento_humano=TRUE AND p.atualizado_em >= date_trunc('month', CURRENT_TIMESTAMP))::int AS humanos,
        (SELECT COUNT(*) FROM projetos p JOIN lembrete_configuracoes l ON l.marcenaria_id=p.marcenaria_id
          WHERE p.marcenaria_id=$1 AND l.ativo=TRUE AND p.lembrete_enviado_em >= date_trunc('month', CURRENT_TIMESTAMP))::int AS lembretes
    `, [req.marcenaria.id]);
    res.json({ periodo: new Date().toLocaleString('pt-BR', { month:'long', year:'numeric' }), ...resultado.rows[0] });
  }));
}
module.exports = { registrarRelatorios };
