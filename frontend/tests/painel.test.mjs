/**
 * Testes de regressão: busca ignora acentos e encontra nome, telefone, móvel e ambiente; combina filtros sem misturar clientes; clientes sem nome ou projetos continuam consultáveis pelo telefone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtrarProjetos, filtrarClientes, formatarMedida, formatarData } from '../src/painel-utils.js';

const projetos = [
  { id: 1, cliente_id: 10, cliente_nome: 'João', telefone: '11999999999', movel: 'Armário', uso: 'Quarto', situacao: { categoria: 'pendente' } },
  { id: 2, cliente_id: 20, cliente_nome: 'Maria', telefone: '11988888888', movel: 'Mesa', uso: 'Sala', situacao: { categoria: 'completo' } },
];
test('busca ignora acentos e encontra nome, telefone, móvel e ambiente', () => {
  for (const busca of ['joao', 'ARMARIO', 'quarto', '11999999999']) assert.deepEqual(filtrarProjetos(projetos, { busca }).map(p => p.id), [1]);
  assert.equal(filtrarProjetos(projetos, { busca: 'inexistente' }).length, 0);
});
test('combina filtros sem misturar clientes', () => {
  assert.equal(filtrarProjetos(projetos, { cliente: '10', categoria: 'completo' }).length, 0);
  assert.deepEqual(filtrarProjetos(projetos, { cliente: '20', categoria: 'completo' }).map(p => p.id), [2]);
  assert.equal(filtrarProjetos(projetos).length, 2);
});
test('clientes sem nome ou projetos continuam consultáveis pelo telefone', () => {
  const clientes = [{ id: 1, nome: null, telefone: '11912345678', total_projetos: 0 }];
  assert.equal(filtrarClientes(clientes, '912345678').length, 1);
});
test('medidas ausentes e datas inválidas não aparecem como dados confirmados', () => {
  assert.equal(formatarMedida(null), 'Não informada');
  assert.equal(formatarMedida(''), 'Não informada');
  assert.equal(formatarMedida('120.50'), '120,5 cm');
  assert.equal(formatarData(null), '—');
  assert.equal(formatarData('inválido'), '—');
});
test('busca encontra solicitações de outros ramos', () => {
  const projeto = {id:99, coleta:{geral:{solicitacao:'Manutenção',detalhes:'Escritório'}}};
  assert.equal(filtrarProjetos([projeto], {busca:'manutencao'}).length,1);
  assert.equal(filtrarProjetos([projeto], {busca:'escritorio'}).length,1);
});
