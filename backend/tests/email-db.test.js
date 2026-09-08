const test=require('node:test');
const assert=require('node:assert/strict');
const pool=require('../database');
const {enviarEmail,processarEmail}=require('../email');
test('fila SQL envia pendentes, preserva simulações e repete falhas', {skip:!process.env.TEST_DATABASE},async()=>{
  const db=await pool.connect();
  try {
    await db.query('BEGIN');
    // Tabela temporária evita tocar em mensagens reais, mesmo com um worker ativo.
    await db.query('CREATE TEMP TABLE emails_saida (LIKE public.emails_saida INCLUDING DEFAULTS) ON COMMIT DROP');
    const env={EMAIL_MODE:'smtp',SMTP_HOST:'smtp.example.invalid',SMTP_USER:'teste',SMTP_PASS:'teste',EMAIL_FROM:'norden@example.invalid',FRONTEND_URL:'https://example.invalid'};
    const mensagem={destinatario:'cliente@example.invalid',assunto:'Teste',texto:'Link de teste'};
    await enviarEmail(db,mensagem,{});
    await enviarEmail(db,mensagem,env);
    let envios=0;
    await processarEmail(db,{sendMail:async()=>{envios++;return {accepted:['cliente@example.invalid']};}},env.EMAIL_FROM);
    assert.equal(envios,1);
    const rows=(await db.query('SELECT status,texto FROM emails_saida ORDER BY id')).rows;
    assert.equal(rows[0].status,'simulado');assert.equal(rows[1].status,'enviado');
    assert.doesNotMatch(rows[1].texto,/Link de teste/);
    await enviarEmail(db,mensagem,env);
    await processarEmail(db,{sendMail:async()=>{throw Error('Falha simulada');}},env.EMAIL_FROM);
    const pendente=(await db.query("SELECT tentativas,proxima_tentativa_em>NOW() AS adiado FROM emails_saida WHERE status='pendente'")).rows[0];
    assert.equal(pendente.tentativas,1);assert.equal(pendente.adiado,true);
  } finally {await db.query('ROLLBACK');db.release();await pool.end();}
});
