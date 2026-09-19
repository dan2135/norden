/**
 * Entrada da API Express: conecta autenticação, seleção da empresa, atendimento e rotas do painel. A ordem dos middlewares mantém as consultas dentro da empresa autorizada.
 */
const express = require("express");
const cors = require("cors");
const path = require('node:path');
const { configuracaoHospedagem } = require('./hospedagem');
const { protegerOrigem } = require('./seguranca');
const pool = require("./database");
const { extrairDadosProjeto } = require("./extracao");
const { analisarMensagem, complementarComIA, responder } = require("./coleta");
const { registrarPainel } = require('./painel');
const { registrarOrcamentos } = require('./orcamentos');
const { registrarEstimativa } = require('./estimativa');
const { registrarMarcenarias, resolverMarcenaria } = require('./marcenarias');
const { registrarAuth } = require('./auth');
const { analisarSolicitacao, responderSolicitacao } = require('./segmentos');
const { registrarLixeira, bloquearArquivados } = require('./lixeira');
const { registrarWebhookAsaas, registrarAssinaturasAsaas } = require('./asaas');
const { registrarWhatsApp, registrarWhatsAppConfiguracoes } = require('./whatsapp');
const { registrarRotasRamos } = require('./ramos-personalizados');

const { validarTelefone, validarId, selecionarProjeto, obterCliente, historicoProjeto, erroHttp } = require("./projetos");

function criarApp({ banco = pool, extrair, logger = console, autenticar: autenticarInjetado } = {}) {
// Permite injetar banco, extração e autenticação nos testes sem mudar a configuração real de produção.
extrair ??= extrairDadosProjeto;
const app = express();

// Segurança básica do Express: CORS restrito, proteção de origem e limite de payload antes de chegar nas rotas.
const { origens } = configuracaoHospedagem();
app.locals.origensPermitidas = origens;
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.use(cors({ credentials: true, origin: (origem, callback) => callback(null, !origem || origens.includes(origem)) }));
app.use('/api', protegerOrigem(origens));
app.use(express.json({ limit: '100kb' }));

// Expõe somente o build público; arquivos privados permanecem fora desta pasta.
if (process.env.SERVE_FRONTEND === 'true') {
  app.use(express.static(path.join(__dirname, '../frontend/dist'), { dotfiles: 'deny' }));
}

app.get("/api/status", (req, res) => {
  // Healthcheck usado pelo frontend para confirmar que o backend atual tem os recursos esperados.
  res.json({
    status: "online",
    sistema: "Norden",
    versao: "coleta-v2",
    recursos: ['painel-v1', 'orcamento-v1', 'estimativa-v1', 'multiempresa-v1', 'autenticacao-v1'],
  });
});

app.get("/api/teste-banco", async (req, res) => {
  // Diagnóstico manual simples: confirma conexão sem expor tabelas, registros ou credenciais.
  try {
    const resultado = await banco.query("SELECT NOW()");

    res.json({
      banco: "conectado",
      horario: resultado.rows[0].now,
    });
  } catch (erro) {
    console.error("Erro no banco:", erro);

    res.status(500).json({
      banco: "erro",
    });
  }
});

const rota = (fn) => async (req, res) => {
  // Wrapper padrão das rotas: converte exceções em JSON seguro e evita repetir try/catch.
  try { await fn(req, res); } catch (erro) {
    console.error("Erro:", erro.message);
    res.status(erro.status || 500).json({ mensagem: erro.status ? erro.message : "Não foi possível concluir. Tente novamente." });
  }
};

registrarWebhookAsaas(app, banco, rota);
registrarWhatsApp(app, banco, rota, { extrair, logger });
registrarRotasRamos(app, banco, rota);
const autenticar = registrarAuth(app, banco, rota);
// A partir daqui as rotas exigem sessão. A seleção da empresa vem antes das consultas de negócio.
app.use('/api', autenticarInjetado || autenticar);
registrarMarcenarias(app, banco, rota);
app.use('/api', (req,res,next) => resolverMarcenaria(req,res,next,banco));
registrarWhatsAppConfiguracoes(app, banco, rota);
registrarLixeira(app, banco, rota);
app.use('/api', (req,res,next) => bloquearArquivados(req,res,next,banco));

// Módulos privados do painel: todos recebem req.marcenaria já validado pelo middleware anterior.
registrarPainel(app, banco, rota);
registrarOrcamentos(app, banco, rota);
registrarEstimativa(app, banco, rota);
registrarAssinaturasAsaas(app, banco, rota);
require('./configuracao-empresa').registrarConfiguracaoEmpresa(app, banco, rota);

app.get("/api/projetos", rota(async (req, res) => {
  // Lista projetos de um telefone dentro da empresa ativa, sem misturar dados entre empresas.
  const telefone = validarTelefone(req.query.telefone);
  const resultado = await banco.query(
    "SELECT p.* FROM projetos p JOIN clientes c ON c.id = p.cliente_id WHERE c.telefone = $1 AND c.marcenaria_id=$2 AND p.marcenaria_id=$2 AND c.excluido_em IS NULL AND p.excluido_em IS NULL ORDER BY p.id DESC", [telefone,req.marcenaria.id]);
  res.json({ projetos: resultado.rows });
}));

app.post("/api/projetos", rota(async (req, res) => {
  // Cria projeto manual para um telefone; obterCliente cria o cliente se ainda não existir.
  const telefone = validarTelefone(req.body?.telefone);
  const db = await banco.connect();
  try {
    await db.query("BEGIN");
    const cliente = await obterCliente(db, telefone, req.marcenaria.id);
    const resultado = await db.query("INSERT INTO projetos (cliente_id,marcenaria_id) VALUES ($1,$2) RETURNING *", [cliente.id,req.marcenaria.id]);
    await db.query("COMMIT");
    res.status(201).json({ projeto: resultado.rows[0] });
  } catch (erro) {
    await db.query("ROLLBACK");
    throw erro;
  } finally { db.release(); }
}));

app.get("/api/projetos/:id/mensagens", rota(async (req, res) => {
  // Histórico público por telefone/projeto, usado para continuar uma conversa específica.
  const telefone = validarTelefone(req.query.telefone);
  const id = validarId(req.params.id);
  const resultado = await banco.query(
    "SELECT p.* FROM projetos p JOIN clientes c ON c.id = p.cliente_id WHERE p.id = $1 AND c.telefone = $2 AND p.marcenaria_id=$3 AND c.marcenaria_id=$3", [id, telefone,req.marcenaria.id]);
  const projeto = resultado.rows[0];
  if (!projeto) throw erroHttp(404, "Projeto não encontrado para este cliente.");
  res.json({ projeto, mensagens: await historicoProjeto(banco, projeto.cliente_id, projeto.id,req.marcenaria.id) });
}));

app.post("/api/mensagem", rota(async (req, res) => {
  // Grava entrada, coleta e resposta na mesma transação: erro reverte o atendimento incompleto.
  const telefone = validarTelefone(req.body?.telefone);
  const { mensagem, projeto_id } = req.body;
  if (typeof mensagem !== "string" || !mensagem.trim() || mensagem.length > 10000) {
    throw erroHttp(400, "Envie uma mensagem de até 10.000 caracteres.");
  }
  const db = await banco.connect();
  try {
    await db.query("BEGIN");
    const cliente = await obterCliente(db, telefone,req.marcenaria.id);
    const projetoSelecionado = await selecionarProjeto(db, cliente.id, projeto_id,req.marcenaria.id);
    await db.query(
      "INSERT INTO mensagens (cliente_id, projeto_id, remetente, texto,marcenaria_id) VALUES ($1, $2, $3, $4,$5)",
      [cliente.id, projetoSelecionado.id, "cliente", mensagem.trim(),req.marcenaria.id]);
    const historicoBanco = { rows: await historicoProjeto(db, cliente.id, projetoSelecionado.id,req.marcenaria.id) };

const historico = historicoBanco.rows.map((item) => ({
  // Histórico no formato "chat" para ser aproveitado por IA quando ela estiver configurada.
  role: item.remetente === "cliente" ? "user" : "assistant",
  content: item.texto,
}));


  const geral = true;
  // Versão básica: o atendimento pelo chat usa coleta geral por ramo e não conduz briefing técnico.
  const analise = analisarSolicitacao(mensagem.trim(), projetoSelecionado, cliente);
  // Só consulta o modelo quando as regras não identificam nenhum dado.
  const precisaIA = !Object.values(analise.dados).some(v => v !== null) && !analise.nome
    && !analise.pendencias.length && !Object.keys(analise.estado.medidas).length
    && !/^(oi|ol[aá]|bom dia|boa tarde|boa noite|sim|ok|obrigad[oa])[.!\s]*$/i.test(mensagem.trim());
  if (precisaIA && !geral) {
    try { complementarComIA(analise, await extrair(historico), historico, projetoSelecionado); }
    catch (erro) {
      analise.descartados.push("IA indisponível");
      logger.warn("[IA] Extração indisponível; atendimento segue pelos dados confirmados:", erro.message);
    }
  }
  const dadosProjeto = analise.dados;
  const pendencias = analise.pendencias;
  const primeiroContato = !historicoBanco.rows.some(item => item.remetente === 'sistema');
  let respostaSistema = responderSolicitacao(analise,cliente,req.marcenaria,primeiroContato);
  let modoIA = 'regras';
  if (process.env.IA_PROVIDER === 'openai') {
    // OpenAI refina a resposta da Suzy, mas se falhar o atendimento continua com a resposta por regras.
    try {
      respostaSistema = await require('./openai').responderComOpenAI({historico,empresa:req.marcenaria,respostaBase:respostaSistema});
      modoIA = 'openai';
    } catch (erro) {
      modoIA = 'contingencia';
      logger.warn('[IA] Resposta guiada utilizada:', erro.message);
    }
  }


  await db.query(
    `
    UPDATE projetos
    SET
      movel = COALESCE($1, movel),
      uso = COALESCE($2, uso),
      largura_cm = COALESCE($3, largura_cm),
      altura_cm = COALESCE($4, altura_cm),
      profundidade_cm = COALESCE($5, profundidade_cm),
      acabamento = COALESCE($6, acabamento),
      detalhes = COALESCE($7, detalhes),
      coleta = $9::jsonb,
      atualizado_em = CURRENT_TIMESTAMP
    WHERE id = $8 AND marcenaria_id=$10
    `,
    [
      dadosProjeto.movel,
      dadosProjeto.uso,
      dadosProjeto.largura_cm,
      dadosProjeto.altura_cm,
      dadosProjeto.profundidade_cm,
      dadosProjeto.acabamento,
      dadosProjeto.detalhes,
      projetoSelecionado.id,
      JSON.stringify(analise.estado),
      req.marcenaria.id,
    ]
  );


const projeto = (await db.query("SELECT * FROM projetos WHERE id = $1 AND cliente_id = $2 AND marcenaria_id=$3",
  [projetoSelecionado.id, cliente.id,req.marcenaria.id])).rows[0];

await db.query(
  "INSERT INTO mensagens (cliente_id, projeto_id, remetente, texto,marcenaria_id) VALUES ($1, $2, $3, $4,$5)",
  [cliente.id, projeto.id, "sistema", respostaSistema,req.marcenaria.id]);
const clienteAtual = (await db.query("UPDATE clientes SET ultima_mensagem = $1, nome = COALESCE($3, nome) WHERE id = $2 AND marcenaria_id=$4 RETURNING *",
  [mensagem.trim(), cliente.id, analise.nome,req.marcenaria.id])).rows[0];
await db.query("COMMIT");
logger.log("[ATENDIMENTO]", JSON.stringify(process.env.NODE_ENV === 'production' ? {
  projeto_id: projeto.id, modo_ia: modoIA,
} : {
  cliente_id: cliente.id, nome: clienteAtual.nome || "não informado", projeto_id: projeto.id,
  mensagem: mensagem.trim(), dados_salvos: dadosProjeto, pendencias, descartados_ia: analise.descartados,
  aguardando: analise.estado, resposta: respostaSistema,
}));
res.json({ resposta: respostaSistema, cliente: clienteAtual, projeto, pendencias, modo_ia: modoIA });
  } catch (erro) {
    await db.query("ROLLBACK");
    throw erro;
  } finally { db.release(); }
}));
app.use("/api", (req, res) => res.status(404).json({ mensagem: "Rota não encontrada. Verifique se o backend está atualizado." }));
app.use((erro, req, res, next) => {
  // Tratamento final de erros do Express; mensagens internas não vazam para o navegador.
  if (res.headersSent) return next(erro);
  const status = erro.status || (erro.type === "entity.too.large" ? 413 : erro instanceof SyntaxError ? 400 : 500);
  res.status(status).json({ mensagem: erro.status ? erro.message : status === 400 ? "JSON inválido." : status === 413 ? "Mensagem muito grande." : "Erro interno no atendimento." });
});
return app;
}

if (require.main === module) {
  // Só abre a porta ao executar este arquivo diretamente; importar criarApp não inicia o servidor.
  const { configuracaoEmail, iniciarEmails } = require('./email');
  configuracaoEmail();
  const { porta, host } = configuracaoHospedagem();
  const servidor = criarApp().listen(porta, host, () => console.log(`Norden rodando na porta ${porta}`));
  servidor.once('listening', () => {
    const pararEmails = iniciarEmails(pool);
    servidor.once('close', pararEmails);
  });
  servidor.on("error", erro => {
    console.error(erro.code === "EADDRINUSE" ? `A porta ${porta} já está em uso. Encerre o backend antigo antes de iniciar.` : erro.message);
    process.exitCode = 1;
  });
}
module.exports = { criarApp };
