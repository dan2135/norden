const { erroHttp } = require('./projetos');

function validarTextoAnalise(texto) {
  if (typeof texto !== 'string' || texto.length > 10000) throw erroHttp(400, 'Mensagem inválida ou muito longa (máximo de 10000 caracteres).');
  // Varredura linear antes dos parsers: impede sequências patológicas sem truncar dados.
  let digitos = 0, espacos = 0;
  for (const caractere of texto) {
    digitos = caractere >= '0' && caractere <= '9' ? digitos + 1 : 0;
    espacos = /\s/u.test(caractere) ? espacos + 1 : 0;
    if (digitos > 32 || espacos > 32) throw erroHttp(400, 'Mensagem contém uma sequência excessiva de números ou espaços.');
  }
  return texto;
}

function emailValido(email) {
  if (typeof email !== 'string' || email.length > 254 || email.length < 3) return false;
  const partes = email.split('@');
  if (partes.length !== 2 || !partes[0] || !partes[1]) return false;
  const ponto = partes[1].lastIndexOf('.');
  return ponto > 0 && ponto < partes[1].length - 1 && !/[\s<>]/u.test(email);
}

function protegerOrigem(origens) {
  const permitidas = new Set(origens);
  return (req, res, next) => {
    if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
    const origem = req.get('origin');
    if (origem && !permitidas.has(origem)) return res.status(403).json({mensagem:'Origem da requisição não autorizada.'});
    if (!origem && req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({mensagem:'Requisição entre sites não autorizada.'});
    // Rotas públicas de autenticação só aceitam JSON, nunca submissões simples de formulário.
    if (req.path.startsWith('/auth/') && req.path !== '/auth/logout' && !req.is('application/json')) return res.status(415).json({mensagem:'Envie os dados como application/json.'});
    next();
  };
}
module.exports = { validarTextoAnalise, emailValido, protegerOrigem };
