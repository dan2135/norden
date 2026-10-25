/** Gestão de identidades reservada ao administrador geral da Norden. */
const { erroHttp, validarId } = require('./projetos');
const { conferirSenha } = require('./auth');
function registrarContasAdmin(app, banco, rota) {
  const somenteAdmin = (req, res, next) => {
    if (!req.usuario?.superadministrador) return res.status(403).json({ mensagem: 'Somente o administrador geral pode gerenciar contas.' });
    next();
  };
  app.get('/api/admin/usuarios', somenteAdmin, rota(async (req, res) => {
    const busca = String(req.query.busca || '').trim().slice(0, 120);
    const pagina = Math.max(1, Number.parseInt(req.query.pagina, 10) || 1);
    const resultado = await banco.query(`SELECT id,nome,email,email_confirmado,ativo,superadministrador FROM usuarios
      WHERE strpos(lower(nome),lower($1))>0 OR strpos(lower(email),lower($1))>0
      ORDER BY id DESC LIMIT 51 OFFSET $2`, [busca, (pagina - 1) * 50]);
    res.json({ usuarios: resultado.rows.slice(0, 50), proxima_pagina: resultado.rows.length > 50 });
  }));
  app.delete('/api/admin/usuarios/:id', somenteAdmin, rota(async (req, res) => {
    const id = validarId(req.params.id), senha = req.body?.senha;
    if (typeof senha !== 'string' || !senha || senha.length > 200) throw erroHttp(400, 'Informe a senha da sua conta administrativa.');
    if (String(id) === String(req.usuario.id)) throw erroHttp(400, 'Você não pode apagar a própria conta por aqui.');
    const db = await banco.connect();
    try {
      await db.query('BEGIN');
      const admin = (await db.query('SELECT senha_hash FROM usuarios WHERE id=$1 AND ativo=TRUE AND superadministrador=TRUE FOR UPDATE', [req.usuario.id])).rows[0];
      if (!admin || !(await conferirSenha(senha, admin.senha_hash))) throw erroHttp(403, 'Senha administrativa incorreta.');
      const alvo = (await db.query('SELECT id,email,superadministrador FROM usuarios WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!alvo) throw erroHttp(404, 'Conta não encontrada.');
      if (alvo.superadministrador) throw erroHttp(403, 'Contas de administrador geral são protegidas contra exclusão.');
      // Trava as empresas antes de remover os vínculos para tratar exclusões concorrentes.
      const empresas = (await db.query(`SELECT m.id FROM marcenarias m
        JOIN membros_marcenaria mm ON mm.marcenaria_id=m.id
        WHERE mm.usuario_id=$1 ORDER BY m.id FOR UPDATE OF m`, [id])).rows.map(m => m.id);
      // Sessões, tokens e vínculos são removidos por ON DELETE CASCADE.
      await db.query('DELETE FROM convites_equipe WHERE criado_por=$1 OR lower(email)=lower($2)', [id, alvo.email]);
      await db.query('DELETE FROM emails_saida WHERE lower(destinatario)=lower($1)', [alvo.email]);
      await db.query('DELETE FROM usuarios WHERE id=$1', [id]);
      const desativadas = (await db.query(`UPDATE marcenarias m SET ativa=FALSE
        WHERE m.id=ANY($1::int[]) AND m.slug<>'principal' AND m.ativa=TRUE
        AND NOT EXISTS (SELECT 1 FROM membros_marcenaria mm
          JOIN usuarios u ON u.id=mm.usuario_id
          WHERE mm.marcenaria_id=m.id AND mm.ativo=TRUE AND u.ativo=TRUE)
        RETURNING m.id`, [empresas])).rows.map(m => m.id);
      await db.query('COMMIT');
      res.json({ mensagem: 'Conta apagada permanentemente. Empresas sem outros usuários ativos foram retiradas do seletor. O CPF/CNPJ pode ser usado em um novo cadastro.', empresas_desativadas: desativadas });
    } catch (erro) { await db.query('ROLLBACK'); throw erro; } finally { db.release(); }
  }));
}
module.exports = { registrarContasAdmin };
