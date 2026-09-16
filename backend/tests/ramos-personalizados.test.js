/**
 * Garante que ramos digitados virem sugestões reaproveitáveis sem depender de dados de clientes.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizarRamo, listarRamosPersonalizados } = require('../ramos-personalizados');

test('normaliza ramo personalizado para chave estável', () => {
  assert.equal(normalizarRamo('  Estética Automotiva & Funilaria  '), 'estetica-automotiva-funilaria');
});

test('lista ramos personalizados unindo biblioteca e empresas existentes', async () => {
  const banco = {
    chamadas: 0,
    async query() {
      this.chamadas += 1;
      return this.chamadas === 1
        ? { rows: [{ chave: 'vidracaria', nome: 'Vidraçaria', usos: 2 }] }
        : { rows: [{ nome: ' vidraçaria ', usos: 1 }, { nome: 'Costura criativa', usos: 2 }] };
    },
  };
  const ramos = await listarRamosPersonalizados(banco);
  assert.deepEqual(ramos.map(r => r.chave), ['vidracaria', 'costura-criativa']);
  assert.equal(ramos[0].usos, 3);
});
