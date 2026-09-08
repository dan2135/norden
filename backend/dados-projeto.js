const campos = ['movel', 'uso', 'largura_cm', 'altura_cm', 'profundidade_cm', 'acabamento', 'detalhes'];
const dimensoes = { largura_cm: 'largura', altura_cm: 'altura', profundidade_cm: 'profundidade' };
const normalizar = texto => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function converterMedida(valor, unidade) {
  const numero = Number(valor.replace(',', '.'));
  const fator = unidade === 'm' ? 100 : unidade === 'mm' ? 0.1 : 1;
  const cm = Math.round(numero * fator * 100) / 100;
  return Number.isFinite(cm) && cm > 0 && cm <= 10000 ? cm : null;
}

function medidaExplicita(texto, campo, perguntaAnterior) {
  const nome = dimensoes[campo];
  const numero = '(?<![\\d.,+−-])(\\d+(?:[.,]\\d+)?)\\s*(mm|cm|m)\\b';
  const s = normalizar(texto);
  if (/\d\s*(?:mm|cm|m)?\s*(?:a|ate|[-–])\s*\d/.test(s)) return null;
  // Não adivinha intervalos, dimensões sem unidade ou ordem de pares/triplas.
  const matches = [...s.matchAll(new RegExp(`\\b${nome}\\s*(?:de|e|:|=)?\\s*${numero}`, 'g')),
    ...s.matchAll(new RegExp(`${numero}\\s*(?:de\\s+)?${nome}\\b`, 'g'))];
  if (matches.length === 1) return converterMedida(matches[0][1], matches[0][2]);
  const simples = s.trim().match(new RegExp(`^${numero}[.!]?$`));
  const pergunta = normalizar(perguntaAnterior || '');
  const citadas = Object.values(dimensoes).filter(d => pergunta.includes(d));
  if (simples && citadas.length === 1 && citadas[0] === nome && pergunta.includes('?')) {
    return converterMedida(simples[1], simples[2]);
  }
  return null;
}

function validarExtracao(extraido, historico) {
  const dados = Object.fromEntries(campos.map(c => [c, null]));
  const pendencias = [];
  const ultima = historico.at(-1);
  if (!extraido || typeof extraido !== 'object' || Array.isArray(extraido) || ultima?.role !== 'user') {
    return { dados, pendencias: ['extração inválida; confirme os dados antes de registrá-los'] };
  }
  const mensagem = ultima.content;
  const incerta = /\b(nao|talvez|acho|ou|entre|corrigir|esqueca|cancele)\b/.test(normalizar(mensagem));
  for (const campo of campos) {
    const item = extraido[campo];
    if (item == null) continue; // Ausência nunca apaga um dado salvo.
    const rejeitar = () => pendencias.push(campo);
    if (typeof item !== 'object' || Array.isArray(item) || typeof item.trecho !== 'string'
      || !item.trecho.trim() || !mensagem.includes(item.trecho) || incerta) {
      rejeitar(); continue;
    }
    if (dimensoes[campo]) {
      const medida = medidaExplicita(mensagem, campo, historico.at(-2)?.role === 'assistant' ? historico.at(-2).content : '');
      if (typeof item.valor !== 'number' || !Number.isFinite(item.valor) || medida === null
        || Math.abs(medida - item.valor) > 0.001) { rejeitar(); continue; }
      dados[campo] = medida;
    } else {
      const limite = campo === 'detalhes' ? 2000 : 100;
      if (typeof item.valor !== 'string' || !item.valor.trim() || item.valor.length > limite
        || !normalizar(item.trecho).includes(normalizar(item.valor.trim()))) { rejeitar(); continue; }
      dados[campo] = item.valor.trim();
    }
  }
  if (!Object.keys(dimensoes).some(c => dados[c] !== null)
    && /(?:\d\s*(?:[x×]|por)\s*\d|(?:largura|altura|profundidade).*\d)/i.test(mensagem)
    && !pendencias.some(c => c in dimensoes)) pendencias.push('medidas');
  return { dados, pendencias };
}

function pedirConfirmacao(pendencias) {
  const campo = pendencias[0];
  if (campo in dimensoes) return `Não confirmei a ${dimensoes[campo]} informada. Qual é a ${dimensoes[campo]}, com a unidade (cm, m ou mm)?`;
  if (campo === 'medidas') return 'Para registrar as medidas corretamente, pode informar cada dimensão com sua unidade, como “largura de 120 cm”?';
  const nomes = { movel: 'móvel desejado', uso: 'uso ou ambiente do móvel', acabamento: 'acabamento desejado', detalhes: 'detalhe do projeto' };
  if (nomes[campo]) return `Não confirmei esse dado. Pode informar o ${nomes[campo]} de forma direta?`;
  return 'Não consegui validar os novos dados. Pode repetir a informação que deseja registrar?';
}

module.exports = { validarExtracao, medidaExplicita, pedirConfirmacao };
