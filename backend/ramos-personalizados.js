/**
 * Biblioteca compartilhada de ramos digitados pelos usuários e catálogo-base por ramo.
 * Compartilha apenas metadados e materiais; clientes, conversas, projetos e orçamentos continuam isolados por empresa.
 */
function normalizarRamo(valor = '') {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
    .replace(/^-|-$/g, '');
}

function usaRamoPersonalizado(empresa = {}) {
  return (empresa.segmento || 'outros') === 'outros' && Boolean(String(empresa.atividade || '').trim());
}

async function registrarRamoPersonalizado(db, empresa = {}) {
  if (!usaRamoPersonalizado(empresa)) return null;
  const nome = String(empresa.atividade || '').trim();
  const chave = normalizarRamo(nome);
  if (!chave) return null;
  const resultado = await db.query(
    `INSERT INTO ramos_personalizados (chave,nome,segmento,usos)
     VALUES ($1,$2,'outros',1)
     ON CONFLICT (chave) DO UPDATE SET
       nome=EXCLUDED.nome,
       usos=ramos_personalizados.usos+1,
       atualizado_em=CURRENT_TIMESTAMP
     RETURNING chave,nome,usos`,
    [chave, nome],
  );
  return resultado.rows[0];
}

async function listarRamosPersonalizados(db) {
  const cadastrados = (await db.query('SELECT chave,nome,usos FROM ramos_personalizados')).rows;
  const empresas = (await db.query("SELECT atividade AS nome, COUNT(*)::int AS usos FROM marcenarias WHERE ativa=TRUE AND segmento='outros' AND trim(atividade)<>'' GROUP BY atividade")).rows;
  const mapa = new Map();
  for (const item of [...cadastrados, ...empresas]) {
    const chave = item.chave || normalizarRamo(item.nome);
    const nome = String(item.nome || '').trim();
    if (!chave || !nome) continue;
    const existente = mapa.get(chave);
    if (!existente) mapa.set(chave, { chave, nome, usos: Number(item.usos) || 1 });
    else {
      existente.usos += Number(item.usos) || 1;
      if (nome.length < existente.nome.length) existente.nome = nome;
    }
  }
  return [...mapa.values()].sort((a, b) => b.usos - a.usos || a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 50);
}

async function copiarCatalogoModelo(db, empresa = {}) {
  const ramo = await registrarRamoPersonalizado(db, empresa);
  if (!ramo) return 0;
  const existente = (await db.query('SELECT COUNT(*)::int AS total FROM catalogo_materiais WHERE marcenaria_id=$1', [empresa.id])).rows[0]?.total || 0;
  if (existente) return 0;
  const resultado = await db.query(
    `INSERT INTO catalogo_materiais (tipo,descricao,fornecedor,unidade_consumo,rendimento_milesimos,preco_centavos,ativo,marcenaria_id,especificacoes)
     SELECT tipo,descricao,fornecedor,unidade_consumo,rendimento_milesimos,preco_centavos,ativo,$2,especificacoes
     FROM catalogo_modelos_ramo
     WHERE ramo_chave=$1 AND ativo=TRUE
     ORDER BY atualizado_em DESC,id DESC
     RETURNING id`,
    [ramo.chave, empresa.id],
  );
  return resultado.rowCount;
}

async function sincronizarMaterialModelo(db, empresa = {}, material = {}) {
  const ramo = await registrarRamoPersonalizado(db, empresa);
  if (!ramo || !material?.descricao || !material?.tipo) return null;
  const resultado = await db.query(
    `INSERT INTO catalogo_modelos_ramo (ramo_chave,tipo,descricao,fornecedor,unidade_consumo,rendimento_milesimos,preco_centavos,ativo,especificacoes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (ramo_chave,tipo,descricao,fornecedor) DO UPDATE SET
       unidade_consumo=EXCLUDED.unidade_consumo,
       rendimento_milesimos=EXCLUDED.rendimento_milesimos,
       preco_centavos=EXCLUDED.preco_centavos,
       ativo=EXCLUDED.ativo,
       especificacoes=EXCLUDED.especificacoes,
       atualizado_em=CURRENT_TIMESTAMP
     RETURNING id`,
    [ramo.chave, material.tipo, material.descricao, material.fornecedor || '', material.unidade_consumo,
      material.rendimento_milesimos, material.preco_centavos, material.ativo !== false, material.especificacoes || ''],
  );
  return resultado.rows[0] || null;
}

async function sincronizarCatalogoEmpresaModelo(db, empresa = {}) {
  if (!usaRamoPersonalizado(empresa)) return 0;
  const materiais = (await db.query('SELECT * FROM catalogo_materiais WHERE marcenaria_id=$1', [empresa.id])).rows;
  for (const material of materiais) await sincronizarMaterialModelo(db, empresa, material);
  return materiais.length;
}

function registrarRotasRamos(app, banco, rota) {
  app.get('/api/ramos-personalizados', rota(async (req, res) => {
    res.json({ ramos: await listarRamosPersonalizados(banco) });
  }));
}

module.exports = {
  normalizarRamo,
  registrarRamoPersonalizado,
  listarRamosPersonalizados,
  copiarCatalogoModelo,
  sincronizarMaterialModelo,
  sincronizarCatalogoEmpresaModelo,
  registrarRotasRamos,
};
