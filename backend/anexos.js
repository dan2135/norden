/** Analisa anexos de um projeto sem guardar o arquivo original: apenas o resumo confirmado fica no histórico. */
const { erroHttp, validarId } = require('./projetos');

const tiposAceitos = new Set(['audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/webm','image/jpeg','image/png','image/webp','application/pdf']);
const limiteBytes = 5 * 1024 * 1024;

function textoResposta(dados) {
  return (dados.output || []).filter(item => item.type === 'message').flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text').map(item => item.text).join('\n').trim();
}

async function analisarAnexo({ nome, tipo, conteudo }, consultar = fetch, env = process.env) {
  if (!env.OPENAI_API_KEY?.trim()) throw erroHttp(503, 'A leitura de anexos ainda não está configurada.');
  if (!tiposAceitos.has(tipo)) throw erroHttp(400, 'Envie áudio, imagem ou PDF.');
  const arquivo = Buffer.from(String(conteudo || ''), 'base64');
  if (!arquivo.length || arquivo.length > limiteBytes) throw erroHttp(400, 'O arquivo precisa ter até 5 MB.');
  const modelo = env.OPENAI_MODEL || 'gpt-4.1-mini';
  let texto = '';
  if (tipo.startsWith('audio/')) {
    const dados = new FormData();
    dados.append('file', new Blob([arquivo], { type: tipo }), nome || 'audio');
    dados.append('model', 'gpt-4o-mini-transcribe');
    dados.append('language', 'pt');
    try {
      const resposta = await consultar('https://api.openai.com/v1/audio/transcriptions', { method:'POST', headers:{ Authorization:`Bearer ${env.OPENAI_API_KEY.trim()}` }, body:dados, signal:AbortSignal.timeout(45000) });
      if (!resposta.ok) throw new Error();
      texto = String((await resposta.json()).text || '').trim();
    } catch { throw erroHttp(502, 'Não foi possível transcrever este áudio agora.'); }
  } else {
    const arquivoEntrada = tipo.startsWith('image/')
      ? { type:'input_image', image_url:`data:${tipo};base64,${arquivo.toString('base64')}` }
      : { type:'input_file', filename:nome || 'projeto.pdf', file_data:`data:${tipo};base64,${arquivo.toString('base64')}` };
    try {
      const resposta = await consultar('https://api.openai.com/v1/responses', { method:'POST', headers:{ Authorization:`Bearer ${env.OPENAI_API_KEY.trim()}`,'Content-Type':'application/json' }, signal:AbortSignal.timeout(45000), body:JSON.stringify({ model:modelo, store:false, instructions:'Você organiza projetos para uma empresa brasileira. Analise somente o arquivo enviado. Resuma em português, separando pedido, medidas, materiais, prazo e observações. Não invente informações; marque o que não estiver claro como "confirmar".', input:[{ role:'user', content:[{ type:'input_text', text:'Leia este anexo de projeto e gere um resumo para revisão humana.' },arquivoEntrada] }], max_output_tokens:900 }) });
      if (!resposta.ok) throw new Error();
      texto = textoResposta(await resposta.json());
    } catch { throw erroHttp(502, 'Não foi possível analisar este arquivo agora.'); }
  }
  if (!texto || texto.length > 8000) throw erroHttp(502, 'A análise do anexo não retornou um resumo válido.');
  return texto;
}

function registrarAnexos(app, banco, rota) {
  app.post('/api/projetos/:id/anexos/analisar', rota(async (req,res) => {
    if (!['proprietario','administrador','superadministrador'].includes(req.marcenaria.papel)) throw erroHttp(403, 'Somente administradores podem analisar anexos.');
    const projetoId = validarId(req.params.id);
    const projeto = (await banco.query('SELECT p.id,p.cliente_id FROM projetos p WHERE p.id=$1 AND p.marcenaria_id=$2 AND p.excluido_em IS NULL', [projetoId,req.marcenaria.id])).rows[0];
    if (!projeto) throw erroHttp(404, 'Projeto não encontrado.');
    const nome = String(req.body?.nome || 'anexo').slice(0,160);
    const tipo = String(req.body?.tipo || '').toLowerCase();
    const resumo = await analisarAnexo({ nome, tipo, conteudo:req.body?.conteudo });
    await banco.query('INSERT INTO mensagens (cliente_id,projeto_id,remetente,texto,marcenaria_id) VALUES ($1,$2,$3,$4,$5)', [projeto.cliente_id,projeto.id,'sistema',`Anexo analisado: ${nome}\n\n${resumo}`,req.marcenaria.id]);
    res.status(201).json({ resumo });
  }));
}
module.exports = { registrarAnexos, analisarAnexo };
