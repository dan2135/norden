import test from 'node:test';
import assert from 'node:assert/strict';
import { telefoneWhatsApp, mensagemOrcamento, linkWhatsApp } from '../src/whatsapp.js';

const orcamento = { id:12, itens:[{ descricao:'MDF branco', quantidade_milesimos:2000, valor_unitario_centavos:35000 }], subtotal_centavos:70000, desconto_centavos:5000, total_centavos:65000, validade:'2026-09-30', observacoes:'Prazo de 20 dias.' };
const projeto = { cliente_nome:'Ana', telefone:'(11) 99999-8888', movel:'Gaveteiro', uso:'Quarto' };

test('normaliza celular brasileiro e não aceita telefone incompleto', () => {
  assert.equal(telefoneWhatsApp(projeto.telefone), '5511999998888');
  assert.equal(telefoneWhatsApp('5511999998888'), '5511999998888');
  assert.equal(telefoneWhatsApp('12345'), null);
});

test('mensagem usa valores fixos do orçamento salvo', () => {
  const texto = mensagemOrcamento(orcamento, projeto);
  assert.match(texto, /ORC-000012/);
  assert.match(texto, /MDF branco/);
  assert.match(texto, /650,00/);
  assert.match(texto, /Prazo de 20 dias/);
});

test('link codifica mensagem e nunca existe sem telefone válido', () => {
  const link = linkWhatsApp(projeto.telefone, 'Olá\nTotal: R$ 10,00');
  assert.match(link, /^https:\/\/wa\.me\/5511999998888\?text=/);
  assert.ok(!link.includes('\n'));
  assert.equal(linkWhatsApp('12', 'teste'), null);
});
