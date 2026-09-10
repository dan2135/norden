/**
 * Separa arquivamento recuperável de exclusão permanente. As operações mantêm o isolamento entre empresas e verificam a senha nas remoções definitivas.
 */
const { validarId, erroHttp } = require('./projetos');
const { conferirSenha } = require('./auth');

// Registra ações de arquivar, restaurar e remover definitivamente clientes e projetos.
function registrarLixeira(app, banco, rota) {
  app.get('/api/projetos/lixeira', rota(async (req,res) => {
    const resultado = await banco.query(`SELECT p.id,p.movel,p.uso,p.excluido_em,c.nome AS cliente_nome,c.telefone,c.excluido_em AS cliente_excluido_em
      FROM projetos p JOIN clientes c ON c.id=p.cliente_id AND c.marcenaria_id=p.marcenaria_id
      WHERE p.marcenaria_id=$1 AND p.excluido_em IS NOT NULL ORDER BY p.excluido_em DESC,p.id DESC`, [req.marcenaria.id]);
    res.json({ projetos: resultado.rows });
  }));

  async function alterar(req,res,tipo,acao) {
    const id=validarId(req.params.id), empresa=req.marcenaria.id;
    if(acao==='permanente') {
      const senha=req.body?.senha;
      if(typeof senha!=='string'||!senha||senha.length>200) throw erroHttp(400,'Informe sua senha para confirmar a exclusão.');
      const usuario=(await banco.query('SELECT senha_hash FROM usuarios WHERE id=$1 AND ativo=TRUE',[req.usuario.id])).rows[0];
      if(!usuario || !(await conferirSenha(senha,usuario.senha_hash))) throw erroHttp(403,'Senha incorreta. Nenhum registro foi excluído.');
    }
    const db=await banco.connect();
    try {
      await db.query('BEGIN');
      const dono=(await db.query(tipo==='cliente'
        ? 'SELECT id,telefone FROM clientes WHERE id=$1 AND marcenaria_id=$2'
        : 'SELECT c.id,c.telefone FROM projetos p JOIN clientes c ON c.id=p.cliente_id WHERE p.id=$1 AND p.marcenaria_id=$2 AND c.marcenaria_id=$2', [id,empresa])).rows[0];
      if(!dono) throw erroHttp(404,'Registro não encontrado.');
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2::text))",[dono.telefone,empresa]);
      const cliente=(await db.query('SELECT excluido_em FROM clientes WHERE id=$1 AND marcenaria_id=$2 FOR UPDATE',[dono.id,empresa])).rows[0];
      if(!cliente) throw erroHttp(404,'Cliente não encontrado.');
      const registro=tipo==='cliente'?cliente:(await db.query('SELECT excluido_em FROM projetos WHERE id=$1 AND marcenaria_id=$2 FOR UPDATE',[id,empresa])).rows[0];
      if(!registro) throw erroHttp(404,'Projeto não encontrado.');
      if(acao==='permanente') {
        if(!registro.excluido_em) throw erroHttp(409,'Mova o registro para a lixeira antes de excluir permanentemente.');
        const ids=tipo==='cliente'
          ? (await db.query('SELECT id FROM projetos WHERE cliente_id=$1 AND marcenaria_id=$2 FOR UPDATE',[id,empresa])).rows.map(p=>p.id)
          : [id];
        await db.query('DELETE FROM orcamento_itens WHERE orcamento_id IN (SELECT id FROM orcamentos WHERE projeto_id=ANY($1::bigint[]) AND marcenaria_id=$2)',[ids,empresa]);
        await db.query('DELETE FROM orcamentos WHERE projeto_id=ANY($1::bigint[]) AND marcenaria_id=$2',[ids,empresa]);
        await db.query(tipo==='cliente'?'DELETE FROM mensagens WHERE cliente_id=$1 AND marcenaria_id=$2':'DELETE FROM mensagens WHERE projeto_id=$1 AND marcenaria_id=$2',[id,empresa]);
        await db.query('DELETE FROM projetos WHERE id=ANY($1::bigint[]) AND marcenaria_id=$2',[ids,empresa]);
        if(tipo==='cliente') await db.query('DELETE FROM clientes WHERE id=$1 AND marcenaria_id=$2',[id,empresa]);
        else await db.query(`UPDATE clientes SET ultima_mensagem=(SELECT texto FROM mensagens WHERE cliente_id=$1 AND marcenaria_id=$2 AND remetente='cliente' ORDER BY criado_em DESC,id DESC LIMIT 1) WHERE id=$1 AND marcenaria_id=$2`,[dono.id,empresa]);
      } else {
        if(cliente.excluido_em) throw erroHttp(409,'Restaure o cliente antes de alterar este projeto.');
        await db.query(`UPDATE projetos SET excluido_em=${acao==='restaurar'?'NULL':'COALESCE(excluido_em,CURRENT_TIMESTAMP)'} WHERE id=$1 AND marcenaria_id=$2`,[id,empresa]);
      }
      await db.query('COMMIT');
      res.json({mensagem:acao==='permanente'?'Exclusão permanente concluída. Não é possível recuperar pela lixeira.':acao==='restaurar'?'Projeto restaurado.':'Projeto movido para a lixeira.'});
    } catch(erro) { await db.query('ROLLBACK'); throw erro; } finally { db.release(); }
  }
  app.delete('/api/projetos/:id', rota((req,res)=>alterar(req,res,'projeto','excluir')));
  app.post('/api/projetos/:id/restaurar', rota((req,res)=>alterar(req,res,'projeto','restaurar')));
  app.delete('/api/projetos/:id/permanente', rota((req,res)=>alterar(req,res,'projeto','permanente')));
  app.delete('/api/clientes/:id/permanente', rota((req,res)=>alterar(req,res,'cliente','permanente')));
  app.get('/api/clientes/lixeira', rota(async (req, res) => {
    const resultado = await banco.query(`SELECT c.id,c.nome,c.telefone,c.excluido_em,
      (SELECT COUNT(*)::int FROM projetos p WHERE p.cliente_id=c.id AND p.marcenaria_id=c.marcenaria_id) AS total_projetos
      FROM clientes c WHERE c.marcenaria_id=$1 AND c.excluido_em IS NOT NULL ORDER BY c.excluido_em DESC,c.id DESC`, [req.marcenaria.id]);
    res.json({ clientes: resultado.rows });
  }));

  async function mover(req, res, restaurar) {
    const id = validarId(req.params.id);
    const db = await banco.connect();
    try {
      await db.query('BEGIN');
      const cliente = (await db.query('SELECT telefone FROM clientes WHERE id=$1 AND marcenaria_id=$2', [id,req.marcenaria.id])).rows[0];
      if (!cliente) throw erroHttp(404, 'Cliente não encontrado.');
      // Mesmo bloqueio usado pelo atendimento: aguarda mensagens em andamento.
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2::text))", [cliente.telefone,req.marcenaria.id]);
      await db.query(`UPDATE clientes SET excluido_em=${restaurar ? 'NULL' : 'COALESCE(excluido_em,CURRENT_TIMESTAMP)'} WHERE id=$1 AND marcenaria_id=$2`, [id,req.marcenaria.id]);
      await db.query('COMMIT');
      res.json({ mensagem: restaurar ? 'Cliente restaurado com seus projetos e histórico.' : 'Cliente movido para a lixeira. Você pode restaurá-lo a qualquer momento.' });
    } catch (erro) { await db.query('ROLLBACK'); throw erro; } finally { db.release(); }
  }
  app.delete('/api/clientes/:id', rota((req, res) => mover(req, res, false)));
  app.post('/api/clientes/:id/restaurar', rota((req, res) => mover(req, res, true)));
}

// Impede usar links antigos para trabalhar com projetos de clientes na lixeira.
// Impede que registros arquivados continuem sendo usados pelas rotas normais de atendimento.
async function bloquearArquivados(req, res, next, banco) {
  try {
    const projeto = req.path.match(/^\/(?:painel\/)?projetos\/(\d+)(?:\/|$)/);
    const orcamento = req.path.match(/^\/orcamentos\/(\d+)(?:\/|$)/);
    if (!projeto && !orcamento) return next();
    const resultado = await banco.query(projeto
      ? `SELECT c.excluido_em,p.excluido_em AS projeto_excluido_em FROM projetos p JOIN clientes c ON c.id=p.cliente_id WHERE p.id=$1 AND p.marcenaria_id=$2 AND c.marcenaria_id=$2`
      : `SELECT c.excluido_em,p.excluido_em AS projeto_excluido_em FROM orcamentos o JOIN projetos p ON p.id=o.projeto_id JOIN clientes c ON c.id=p.cliente_id WHERE o.id=$1 AND o.marcenaria_id=$2 AND p.marcenaria_id=$2 AND c.marcenaria_id=$2`, [validarId((projeto || orcamento)[1]),req.marcenaria.id]);
    if (resultado.rows[0]?.excluido_em) throw erroHttp(409, 'Cliente na lixeira. Restaure-o no painel para continuar.');
    if (resultado.rows[0]?.projeto_excluido_em) throw erroHttp(409, 'Projeto na lixeira. Restaure-o no painel para continuar.');
    next();
  } catch (erro) { next(erro); }
}
module.exports = { registrarLixeira, bloquearArquivados };
