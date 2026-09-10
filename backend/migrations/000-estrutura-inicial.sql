-- Cria as três tabelas legadas básicas antes das alterações incrementais; mantém craido_em por compatibilidade com o esquema existente.
-- Estrutura legada necessária antes das migrações incrementais.
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100), telefone VARCHAR(30) NOT NULL,
  interesse VARCHAR(100), status VARCHAR(50) DEFAULT 'novo',
  ultima_mensagem TEXT,
  craido_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS projetos (
  id SERIAL PRIMARY KEY, cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  movel VARCHAR(100), uso VARCHAR(100),
  largura_cm NUMERIC, altura_cm NUMERIC, profundidade_cm NUMERIC,
  acabamento VARCHAR(100), detalhes TEXT,
  status VARCHAR(50) DEFAULT 'coletando_dados',
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ativo BOOLEAN DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS mensagens (
  id SERIAL PRIMARY KEY, cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  remetente VARCHAR(20) NOT NULL, texto TEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
