/** Convites de equipe sem expor dados ou permitir mudança do proprietário. */
const crypto = require('node:crypto');
const { erroHttp } = require('./projetos');
const { enviarEmail } = require('./email');
const emailValido = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const podeGerir = req => ['proprietario','administrador','superadministrador'].includes(req.marcenaria.papel);
const hash = texto => crypto.createHash('sha256').update(texto).digest('hex');

function aceitarConvite(app, banco, rota) {
  app.post('/api/equipe/convites/aceitar', rota(async (req,res) => {
    const token=String(req.body?.token||'');
    if (!/^[a-f0-9]{48}$/i.test(token)) throw erroHttp(400,'Convite inválido.');
    const db=await banco.connect();
    try { await db.query('BEGIN');
      const convite=(await db.query(`SELECT * FROM convites_equipe WHERE token_hash=$1 AND aceito_em IS NULL AND expira_em>CURRENT_TIMESTAMP FOR UPDATE`,[hash(token)])).rows[0];
      if (!convite) throw erroHttp(400,'Este convite expirou ou já foi usado.');
      if (convite.email.toLowerCase()!==String(req.usuario.email).toLowerCase()) throw erroHttp(403,'Entre com o e-mail que recebeu o convite.');
      await db.query(`INSERT INTO membros_marcenaria (usuario_id,marcenaria_id,papel,ativo) VALUES ($1,$2,$3,TRUE)
        ON CONFLICT (usuario_id,marcenaria_id) DO UPDATE SET papel=EXCLUDED.papel,ativo=TRUE`,[req.usuario.id,convite.marcenaria_id,convite.papel]);
      await db.query('UPDATE convites_equipe SET aceito_em=CURRENT_TIMESTAMP WHERE id=$1',[convite.id]); await db.query('COMMIT');
      res.json({mensagem:'Você entrou para a equipe. Atualize a página para escolher a empresa.'});
    } catch(e){await db.query('ROLLBACK');throw e;} finally{db.release();}
  }));
}
function registrarEquipe(app, banco, rota) {
  app.get('/api/equipe', rota(async (req,res) => {
    const membros = (await banco.query(`SELECT u.id,u.nome,u.email,mm.papel,mm.criado_em
      FROM membros_marcenaria mm JOIN usuarios u ON u.id=mm.usuario_id
      WHERE mm.marcenaria_id=$1 AND mm.ativo=TRUE ORDER BY CASE mm.papel WHEN 'proprietario' THEN 0 WHEN 'administrador' THEN 1 ELSE 2 END,u.nome`, [req.marcenaria.id])).rows;
    const convites = podeGerir(req) ? (await banco.query(`SELECT id,email,papel,expira_em,criado_em FROM convites_equipe
      WHERE marcenaria_id=$1 AND aceito_em IS NULL AND expira_em>CURRENT_TIMESTAMP ORDER BY criado_em DESC`,[req.marcenaria.id])).rows : [];
    res.json({ membros, convites, pode_gerir:podeGerir(req) });
  }));
  app.post('/api/equipe/convites', rota(async (req,res) => {
    if (!podeGerir(req)) throw erroHttp(403,'Somente administradores podem convidar pessoas.');
    const email=String(req.body?.email||'').trim().toLowerCase(), papel=String(req.body?.papel||'atendente');
    if (!emailValido(email)) throw erroHttp(400,'Informe um e-mail válido.');
    if (!['administrador','atendente'].includes(papel)) throw erroHttp(400,'Escolha uma função válida.');
    const jaMembro=(await banco.query(`SELECT 1 FROM membros_marcenaria mm JOIN usuarios u ON u.id=mm.usuario_id WHERE mm.marcenaria_id=$1 AND lower(u.email)=$2 AND mm.ativo=TRUE`,[req.marcenaria.id,email])).rows[0];
    if (jaMembro) throw erroHttp(409,'Essa pessoa já faz parte da equipe.');
    const token=crypto.randomBytes(24).toString('hex');
    await banco.query('DELETE FROM convites_equipe WHERE marcenaria_id=$1 AND lower(email)=lower($2) AND aceito_em IS NULL',[req.marcenaria.id,email]);
    await banco.query(`INSERT INTO convites_equipe (marcenaria_id,email,papel,token_hash,expira_em,criado_por)
      VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP+INTERVAL '7 days',$5)`,[req.marcenaria.id,email,papel,hash(token),req.usuario.id]);
    const link=`${(process.env.FRONTEND_URL||'').replace(/\/$/,'')}/?convite=${token}`;
    await enviarEmail(banco,{destinatario:email,assunto:`Convite para a equipe da ${req.marcenaria.nome}`,texto:`Você foi convidado para a equipe da ${req.marcenaria.nome}. Entre ou crie sua conta com este e-mail e abra: ${link}`});
    res.status(201).json({ mensagem:'Convite enviado. Ele vence em 7 dias.' });
  }));
}
module.exports = { registrarEquipe, aceitarConvite };
