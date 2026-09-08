const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { validarSegmento } = require('./segmentos');
const { erroHttp } = require('./projetos');
const { slugify } = require('./marcenarias');
const { enviarEmail } = require('./email');

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'marceneiro_session';
const DURACAO_SESSAO_MS = 7 * 24 * 60 * 60 * 1000;

function validarCadastro(body = {}) {
  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const senha = typeof body.senha === 'string' ? body.senha : '';
  if (!nome || nome.length > 120) throw erroHttp(400, 'Informe seu nome (até 120 caracteres).');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw erroHttp(400, 'Informe um e-mail válido.');
  if (senha.length < 10 || senha.length > 200) throw erroHttp(400, 'A senha deve ter entre 10 e 200 caracteres.');
  return { nome, email, senha };
}

function validarDocumento(valor) {
  const documento = String(valor || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (![11,14].includes(documento.length) || /^(.)\1+$/.test(documento)) throw erroHttp(400, 'Informe um CPF ou CNPJ válido.');
  const valorCaractere = caractere => caractere.charCodeAt(0)-48;
  const calcular = (base, pesos) => { const soma = pesos.reduce((total,peso,i)=>total+valorCaractere(base[i])*peso,0); const resto=soma%11; return resto<2?0:11-resto; };
  if (documento.length===11) {
    if(!/^\d{11}$/.test(documento)) throw erroHttp(400,'CPF inválido.');
    const d1=calcular(documento,[10,9,8,7,6,5,4,3,2]); const d2=calcular(documento,[11,10,9,8,7,6,5,4,3,2]);
    if (`${d1}${d2}`!==documento.slice(-2)) throw erroHttp(400, 'CPF inválido.');
  } else {
    if(!/^[A-Z0-9]{12}\d{2}$/.test(documento)) throw erroHttp(400,'CNPJ inválido.');
    const d1=calcular(documento,[5,4,3,2,9,8,7,6,5,4,3,2]); const d2=calcular(documento,[6,5,4,3,2,9,8,7,6,5,4,3,2]);
    if (`${d1}${d2}`!==documento.slice(-2)) throw erroHttp(400, 'CNPJ inválido.');
  }
  return documento;
}

function novoToken() { const token=crypto.randomBytes(32).toString('hex'); return { token, hash:hashToken(token) }; }
function urlFrontend(caminho) { return `${(process.env.FRONTEND_URL || 'http://localhost:5176').replace(/\/$/,'')}${caminho}`; }
function obterIp(req) { return String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/,'').slice(0,64); }

async function criarHashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(senha, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt}$${hash.toString('hex')}`;
}

async function conferirSenha(senha, registro) {
  try {
    const [algoritmo, n, r, p, salt, esperadoHex] = String(registro).split('$');
    if (algoritmo !== 'scrypt') return false;
    const esperado = Buffer.from(esperadoHex, 'hex');
    const obtido = await scrypt(senha, salt, esperado.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
    return esperado.length === obtido.length && crypto.timingSafeEqual(esperado, obtido);
  } catch { return false; }
}

function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function lerCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf('='); return [v.slice(0, i), decodeURIComponent(v.slice(i + 1))];
  }));
}
function opcoesCookie() { return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api', maxAge: DURACAO_SESSAO_MS }; }

async function criarSessao(db, usuarioId, res) {
  const token = crypto.randomBytes(32).toString('hex');
  const csrf = crypto.randomBytes(32).toString('hex');
  await db.query('DELETE FROM sessoes WHERE expira_em <= CURRENT_TIMESTAMP');
  await db.query('INSERT INTO sessoes (token_hash,usuario_id,csrf_token,expira_em) VALUES ($1,$2,$3,$4)',
    [hashToken(token), usuarioId, csrf, new Date(Date.now() + DURACAO_SESSAO_MS)]);
  res.cookie(COOKIE, token, opcoesCookie());
  return csrf;
}

function registrarAuth(app, banco, rota) {
  app.get('/api/auth/estado', rota(async (req, res) => {
    const resultado = await banco.query('SELECT EXISTS (SELECT 1 FROM usuarios) AS configurado');
    res.json({ configurado: resultado.rows[0].configurado });
  }));

  app.post('/api/auth/configurar', rota(async (req, res) => {
    const dados = validarCadastro(req.body);
    const db = await banco.connect();
    try {
      await db.query('BEGIN');
      await db.query('LOCK TABLE usuarios IN EXCLUSIVE MODE');
      if ((await db.query('SELECT EXISTS (SELECT 1 FROM usuarios) AS existe')).rows[0].existe) throw erroHttp(409, 'O acesso inicial já foi configurado. Faça login.');
      const senhaHash = await criarHashSenha(dados.senha);
      const usuario = (await db.query('INSERT INTO usuarios (nome,email,senha_hash) VALUES ($1,$2,$3) RETURNING id,nome,email', [dados.nome,dados.email,senhaHash])).rows[0];
      const marcenaria = (await db.query("SELECT id,nome,slug FROM marcenarias WHERE slug='principal' AND ativa=TRUE")).rows[0];
      if (!marcenaria) throw new Error('Marcenaria principal não encontrada. Execute as migrações.');
      await db.query("INSERT INTO membros_marcenaria (usuario_id,marcenaria_id,papel) VALUES ($1,$2,'proprietario')", [usuario.id,marcenaria.id]);
      const csrf_token = await criarSessao(db, usuario.id, res);
      await db.query('COMMIT');
      res.status(201).json({ usuario, marcenarias: [{ ...marcenaria, papel: 'proprietario' }], csrf_token });
    } catch (erro) { await db.query('ROLLBACK'); throw erro; } finally { db.release(); }
  }));

  app.post('/api/auth/cadastro', rota(async (req,res) => {
    const dados=validarCadastro(req.body); const documento=validarDocumento(req.body?.documento);
    const segmento=validarSegmento(req.body?.segmento);
    const empresa=typeof req.body?.empresa==='string'?req.body.empresa.trim():'';
    if (!empresa || empresa.length>120) throw erroHttp(400,'Informe o nome da marcenaria.');
    const db=await banco.connect();
    try {
      await db.query('BEGIN');
      const senhaHash=await criarHashSenha(dados.senha);
      const usuario=(await db.query(`INSERT INTO usuarios (nome,email,senha_hash,documento,email_confirmado)
        VALUES ($1,$2,$3,$4,FALSE) RETURNING id,nome,email`,[dados.nome,dados.email,senhaHash,documento])).rows[0];
      const base=slugify(empresa); let marcenaria;
      for(let i=0;i<20&&!marcenaria;i++){const slug=i?`${base}-${i+1}`:base;marcenaria=(await db.query('INSERT INTO marcenarias (nome,slug,segmento) VALUES ($1,$2,$3) ON CONFLICT (slug) DO NOTHING RETURNING id,nome,slug,segmento',[empresa,slug,segmento])).rows[0];}
      if(!marcenaria) throw erroHttp(409,'Já existem muitas marcenarias com esse nome.');
      await db.query("INSERT INTO membros_marcenaria (usuario_id,marcenaria_id,papel) VALUES ($1,$2,'proprietario')",[usuario.id,marcenaria.id]);
      const confirmacao=novoToken();
      await db.query("INSERT INTO tokens_usuario (token_hash,usuario_id,tipo,expira_em) VALUES ($1,$2,'confirmar_email',CURRENT_TIMESTAMP+INTERVAL '24 hours')",[confirmacao.hash,usuario.id]);
      const link=urlFrontend(`/?confirmar=${confirmacao.token}`);
      await enviarEmail(db,{destinatario:usuario.email,assunto:'Confirme seu cadastro na Norden',texto:`Olá, ${usuario.nome}. Confirme seu cadastro acessando: ${link}`});
      await db.query('COMMIT'); res.status(201).json({mensagem:'Cadastro criado. Confira seu e-mail para ativar a conta.'});
    } catch(erro){await db.query('ROLLBACK');if(erro.code==='23505')throw erroHttp(409,'Este e-mail ou CPF/CNPJ já está cadastrado.');throw erro;}finally{db.release();}
  }));

  app.post('/api/auth/confirmar-email', rota(async(req,res)=>{
    const token=String(req.body?.token||'');
    const resultado=await banco.query(`UPDATE usuarios u SET email_confirmado=TRUE FROM tokens_usuario t
      WHERE t.token_hash=$1 AND t.usuario_id=u.id AND t.tipo='confirmar_email' AND t.usado_em IS NULL AND t.expira_em>CURRENT_TIMESTAMP RETURNING u.id`,[hashToken(token)]);
    if(!resultado.rows[0]) throw erroHttp(400,'Link de confirmação inválido ou expirado.');
    await banco.query("UPDATE tokens_usuario SET usado_em=CURRENT_TIMESTAMP WHERE token_hash=$1",[hashToken(token)]);
    res.json({mensagem:'E-mail confirmado. Você já pode entrar.'});
  }));

  app.post('/api/auth/esqueci-senha', rota(async(req,res)=>{
    const email=String(req.body?.email||'').trim().toLowerCase();
    const usuario=(await banco.query('SELECT id,nome,email FROM usuarios WHERE lower(email)=$1 AND ativo=TRUE',[email])).rows[0];
    if(usuario){const redefinicao=novoToken();await banco.query("UPDATE tokens_usuario SET usado_em=CURRENT_TIMESTAMP WHERE usuario_id=$1 AND tipo='redefinir_senha' AND usado_em IS NULL",[usuario.id]);await banco.query("INSERT INTO tokens_usuario (token_hash,usuario_id,tipo,expira_em) VALUES ($1,$2,'redefinir_senha',CURRENT_TIMESTAMP+INTERVAL '1 hour')",[redefinicao.hash,usuario.id]);await enviarEmail(banco,{destinatario:usuario.email,assunto:'Redefinição de senha da Norden',texto:`Redefina sua senha em: ${urlFrontend(`/?redefinir=${redefinicao.token}`)}`});}
    res.json({mensagem:'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.'});
  }));

  app.post('/api/auth/redefinir-senha', rota(async(req,res)=>{
    const token=String(req.body?.token||'');const senha=String(req.body?.senha||'');
    if(senha.length<10||senha.length>200)throw erroHttp(400,'A nova senha deve ter entre 10 e 200 caracteres.');
    const registro=(await banco.query("SELECT usuario_id FROM tokens_usuario WHERE token_hash=$1 AND tipo='redefinir_senha' AND usado_em IS NULL AND expira_em>CURRENT_TIMESTAMP",[hashToken(token)])).rows[0];
    if(!registro)throw erroHttp(400,'Link de redefinição inválido ou expirado.');
    await banco.query('UPDATE usuarios SET senha_hash=$1,trocar_senha=FALSE WHERE id=$2',[await criarHashSenha(senha),registro.usuario_id]);
    await banco.query('UPDATE tokens_usuario SET usado_em=CURRENT_TIMESTAMP WHERE token_hash=$1',[hashToken(token)]);await banco.query('DELETE FROM sessoes WHERE usuario_id=$1',[registro.usuario_id]);
    res.json({mensagem:'Senha atualizada. Entre com a nova senha.'});
  }));

  app.post('/api/auth/login', rota(async (req, res) => {
    const identificador = typeof req.body?.identificador === 'string' ? req.body.identificador.trim().toLowerCase() : '';
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
    const usuario = (await banco.query('SELECT id,nome,email,usuario,senha_hash,superadministrador,trocar_senha,email_confirmado,ultimo_ip FROM usuarios WHERE (lower(usuario)=$1 OR lower(email)=$1) AND ativo=TRUE', [identificador])).rows[0];
    if (!usuario || !(await conferirSenha(senha, usuario.senha_hash))) throw erroHttp(401, 'E-mail ou senha incorretos.');
    if (!usuario.email_confirmado) throw erroHttp(403,'Confirme seu e-mail antes de entrar.');
    if (process.env.NODE_ENV === 'production' && usuario.trocar_senha) throw erroHttp(403, 'Troque a senha temporária antes de usar este acesso em produção.');
    const csrf_token = await criarSessao(banco, usuario.id, res);
    const ipAtual=obterIp(req); const ipDiferente=Boolean(usuario.ultimo_ip&&usuario.ultimo_ip!==ipAtual);
    await banco.query('UPDATE usuarios SET ultimo_ip=$1,ultimo_login_em=CURRENT_TIMESTAMP WHERE id=$2',[ipAtual,usuario.id]);
    if(ipDiferente) await enviarEmail(banco,{destinatario:usuario.email,assunto:'Novo acesso à Norden',texto:`Detectamos um login em um endereço de rede diferente (${ipAtual}). Se não foi você, redefina sua senha.`});
    const marcenarias = usuario.superadministrador
      ? (await banco.query("SELECT id,nome,slug,segmento,'superadministrador' AS papel FROM marcenarias WHERE ativa=TRUE ORDER BY nome,id")).rows
      : (await banco.query(`SELECT m.id,m.nome,m.slug,m.segmento,mm.papel FROM membros_marcenaria mm JOIN marcenarias m ON m.id=mm.marcenaria_id WHERE mm.usuario_id=$1 AND mm.ativo=TRUE AND m.ativa=TRUE ORDER BY m.nome,m.id`, [usuario.id])).rows;
    delete usuario.senha_hash;
    res.json({ usuario, marcenarias, csrf_token, trocar_senha: usuario.trocar_senha });
  }));

  async function autenticar(req, res, next) {
    try {
      const token = lerCookies(req)[COOKIE];
      if (!token) throw erroHttp(401, 'Faça login para continuar.');
      const sessao = (await banco.query(`SELECT s.token_hash,s.csrf_token,s.usuario_id,u.nome,u.email,u.usuario,u.superadministrador,u.trocar_senha FROM sessoes s JOIN usuarios u ON u.id=s.usuario_id WHERE s.token_hash=$1 AND s.expira_em>CURRENT_TIMESTAMP AND u.ativo=TRUE`, [hashToken(token)])).rows[0];
      if (!sessao) { res.clearCookie(COOKIE, opcoesCookie()); throw erroHttp(401, 'Sua sessão expirou. Faça login novamente.'); }
      if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('x-csrf-token') !== sessao.csrf_token) throw erroHttp(403, 'Sessão inválida. Atualize a página e tente novamente.');
      req.usuario = { id: sessao.usuario_id, nome: sessao.nome, email: sessao.email, usuario: sessao.usuario, superadministrador: sessao.superadministrador, trocar_senha: sessao.trocar_senha };
      req.csrfToken = sessao.csrf_token;
      banco.query('UPDATE sessoes SET ultimo_uso_em=CURRENT_TIMESTAMP WHERE token_hash=$1', [sessao.token_hash]).catch(() => {});
      next();
    } catch (erro) { next(erro); }
  }

  app.get('/api/auth/sessao', autenticar, rota(async (req, res) => {
    const marcenarias = req.usuario.superadministrador
      ? (await banco.query("SELECT id,nome,slug,segmento,'superadministrador' AS papel FROM marcenarias WHERE ativa=TRUE ORDER BY nome,id")).rows
      : (await banco.query(`SELECT m.id,m.nome,m.slug,m.segmento,mm.papel FROM membros_marcenaria mm JOIN marcenarias m ON m.id=mm.marcenaria_id WHERE mm.usuario_id=$1 AND mm.ativo=TRUE AND m.ativa=TRUE ORDER BY m.nome,m.id`, [req.usuario.id])).rows;
    res.json({ usuario: req.usuario, marcenarias, csrf_token: req.csrfToken });
  }));
  app.post('/api/auth/logout', autenticar, rota(async (req, res) => {
    const token = lerCookies(req)[COOKIE];
    await banco.query('DELETE FROM sessoes WHERE token_hash=$1', [hashToken(token)]);
    res.clearCookie(COOKIE, opcoesCookie());
    res.json({ ok: true });
  }));
  return autenticar;
}

module.exports = { registrarAuth, criarHashSenha, conferirSenha, validarDocumento };
