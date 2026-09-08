# Norden

Plataforma de gestão e atendimento com a assistente virtual Suzy, para organizar clientes, projetos e orçamentos de empresas de diferentes segmentos.

## Estado atual

React/Vite no frontend, Node.js/Express no backend e PostgreSQL. Inclui autenticação, isolamento por empresa, cadastro por CPF/CNPJ, recuperação de senha, fila de e-mails SMTP, lixeira recuperável e orçamentos. O atendimento multissetor é guiado; a estimativa de materiais permanece específica para marcenaria.

Este repositório contém código e migrações, não o banco nem as credenciais. Ainda é uma aplicação em desenvolvimento local, não pronta para publicação em produção. Hospedagem, assinatura, integração com ChatGPT e atendimento automático pelo WhatsApp ainda estão pendentes. O compartilhamento de orçamento pelo WhatsApp é manual.

Para configurar, instale as dependências com `npm install` nas pastas `backend` e `frontend`, copie `backend/.env.example` para `backend/.env` e preencha a configuração do PostgreSQL existente. Não publique o `.env`. Consulte `backend/EMAIL-SETUP.md` para e-mails. A inicialização e o histórico técnico estão abaixo; as seções antigas descrevem o estado de cada etapa, não todas as funcionalidades atuais.

## Histórico de desenvolvimento

## Passo 14.5 — base multiempresa

O sistema agora separa os dados por marcenaria. A barra superior permite escolher a empresa ativa e criar outra durante o desenvolvimento. Clientes com o mesmo telefone podem existir em marcenarias diferentes sem compartilhar projetos, mensagens, catálogo ou orçamentos.

Todos os registros antigos foram preservados em **Marcenaria principal**. A migração 005 adiciona a empresa aos registros e troca a unicidade global do telefone por unicidade dentro de cada marcenaria.

**Importante:** o seletor e o cabeçalho `X-Marcenaria-ID` organizam e testam o isolamento, mas não são autenticação. Esta versão continua somente local. Antes de publicar, o identificador deverá vir da sessão de login verificada no servidor, nunca de uma escolha livre do navegador.

## Passo 14 — WhatsApp

Um orçamento salvo e marcado como **Pronto para enviar** pode ser preparado para WhatsApp pela própria ficha. A tela mostra uma prévia com cliente, número do orçamento, móvel, itens, subtotal, desconto, total, validade e observações. **Abrir no WhatsApp** usa o número cadastrado do cliente e preenche a mensagem; o envio só acontece depois da confirmação manual dentro do WhatsApp.

Alterações ainda não salvas bloqueiam o botão para impedir o envio de um valor diferente do banco. Telefones brasileiros com DDD recebem o código do país automaticamente; números incompletos são recusados. O sistema não afirma que a mensagem foi enviada e não muda o orçamento para aprovado.

## Passo 13 — orçamento

Cada ficha de projeto agora permite criar e editar um orçamento manual. Os preços nunca são inventados pela IA: o marceneiro informa descrição, categoria, quantidade, unidade e valor unitário de cada item. O servidor calcula subtotal e total em centavos, valida o desconto e impede salvar por cima de uma versão alterada em outra tela.

O orçamento começa como **Rascunho** e pode ser marcado manualmente como **Pronto para enviar**, **Aprovado pelo cliente** ou **Recusado**. Marcar uma situação não envia mensagens e não altera a coleta. A impressão do navegador permite imprimir ou salvar uma cópia em PDF; o envio pelo WhatsApp permanece para o passo 14.

Os campos incluem validade, desconto fixo e observações. Um orçamento vazio ou sem valor não pode sair de rascunho. A migração 003 cria as tabelas de orçamentos e itens sem apagar clientes, projetos ou mensagens.

### Passo 13.1 — catálogo e estimativa

O botão **Estimar pelos materiais** abre um catálogo local. Cadastre os preços atuais de chapas, fitas, dobradiças, corrediças e puxadores, informando fornecedor, rendimento da embalagem e data atualizada automaticamente. O estimador usa as medidas confirmadas do projeto, calcula consumo com perdas declaradas e arredonda para embalagens inteiras. Materiais sem preço são mostrados como faltantes; nenhum valor é preenchido pela IA.

A prévia informa as suposições usadas. Só depois de clicar em **Adicionar estes itens ao orçamento** os itens entram no rascunho, ainda sem salvar. Revise plano de corte, ferragens, frete e preço antes de enviar ao cliente. Os valores são referências locais, não cotações oficiais da Léo Madeiras.

A migração 004 cria o catálogo de materiais. Ela começa vazia para não cadastrar preços inventados ou vencidos.

## Passo 12 — painel

A tela inicial agora é o **Painel**, com visão geral dos clientes e projetos. A aba **Atendimento** mantém o chat existente; alternar entre as abas preserva o texto ainda não enviado no atendimento.

- **Projetos:** busque por cliente, telefone, móvel ou ambiente; filtre por cliente e situação da coleta. A lista é paginada e ordenada pela atualização mais recente.
- **Clientes:** consulte nome, telefone, quantidade de projetos e última mensagem. **Ver projetos** filtra a lista para aquele cliente, inclusive quando ele ainda não tem projetos.
- **Ver ficha:** mostra os dados salvos, informações faltantes, medidas aguardando unidade e histórico exclusivo do projeto.
- **Atualizar painel:** consulta novamente o banco. Ao voltar do atendimento para o painel, a consulta também é atualizada.

Os indicadores mostram o total geral, sem aplicar os filtros da lista. **Confirmar dados** indica dúvidas ou medidas pendentes. **Dados completos** exige nome do cliente, móvel, ambiente, largura, altura, profundidade e acabamento, sem pendências. Detalhes são opcionais. Essa indicação não aprova orçamento e não altera o status salvo no banco.

O painel continua local e sem login; requisições de páginas com origem externa são bloqueadas nas rotas do painel e dos orçamentos, mas isso não substitui autenticação. Não publique esta versão na internet.

Não há migração de banco nova nesta etapa. Se aparecer o aviso de backend antigo, reinicie-o uma vez com `npm.cmd start` e atualize o painel. O atendimento de demonstração continua usando o telefone configurado em `VITE_TELEFONE`; consultar outro cliente no painel não muda esse telefone.

## Iniciar

No terminal do backend:

```powershell
cd C:\Users\thepi\marceneiro-ia\backend
npm.cmd start
```

No terminal do frontend:

```powershell
cd C:\Users\thepi\marceneiro-ia\frontend
npm.cmd run dev
```

O backend precisa do PostgreSQL configurado em `backend/.env`. O Ollama local com `llama3.2:3b` é usado como apoio à extração; a coleta dos casos comuns não depende dele.

`npm.cmd start` aplica as migrações reaplicáveis e inicia o servidor em modo de observação: alterações no código reiniciam o backend automaticamente. Se uma versão antiga já ocupa a porta 3000, encerre-a primeiro com Ctrl+C. O terminal deve mostrar **coleta-v2** e **logs do atendimento ativos**. A tela detecta versões antigas e orienta a atualização.

## Como funciona

- O seletor permite criar e retomar projetos do mesmo cliente, com históricos separados.
- Um fluxo guiado escolhe a próxima pergunta pelos dados confirmados. A IA não decide se deve voltar a perguntar o móvel.
- Erros de extração são descartados e registrados nos logs; não são tratados como falta de informação do cliente.
- Medidas identificadas sem unidade ficam pendentes no projeto, inclusive depois de recarregar a página. Uma confirmação como “sim” à pergunta sobre centímetros conclui o registro.
- Valores em m, cm e mm são convertidos para centímetros. Medidas ambíguas, intervalos ou inválidas pedem confirmação. Uma dimensão corrigida não apaga as outras.
- Nome explicitamente informado, ambiente, acabamento e características comuns são registrados. A tela mostra os dados salvos e avisa sobre medidas aguardando unidade.
- O atendimento não inventa preço, prazo nem afirma ter enviado informações a terceiros.
- Em falha do modelo, a coleta continua pelos dados conhecidos. Em falha de gravação no banco, o envio inteiro é revertido.
- Os logs do CMD mostram cliente/nome, projeto, mensagem, campos salvos, pendências, descartes da IA e resposta. São logs locais e podem conter informações do atendimento; evite compartilhá-los sem revisão.

O telefone padrão continua sendo o de demonstração. Para outro ambiente local, o frontend aceita `VITE_TELEFONE` e `VITE_API_URL`. Essas configurações não são autenticação. Não exponha esta versão à internet: ela não tem login e não verifica identidade por telefone. O backend inicia apenas na interface local 127.0.0.1.

## Banco e preservação de dados

A migração 001 vincula mensagens antigas apenas quando o cliente tem um único projeto. Histórico ambíguo permanece preservado, sem atribuição automática.

A migração 002 adiciona o estado de coleta em JSON ao projeto, incluindo medidas aguardando unidade e dúvidas ainda não resolvidas. Nenhuma dessas migrações apaga clientes, projetos ou mensagens.

Dados antigos não são reinterpretados automaticamente. Medidas enviadas antes desta revisão e que não foram salvas precisam ser reenviadas uma vez para iniciar a confirmação no novo fluxo.

## API

- `GET /api/status`: estado e versão do servidor.
- `GET /api/painel`: clientes, projetos, indicadores e situação calculada da coleta (somente consulta local).
- `GET /api/painel/projetos/:id`: ficha e histórico exclusivo do projeto (somente consulta local).
- `GET /api/projetos/:id/orcamento`: consulta o orçamento ligado ao projeto.
- `POST /api/projetos/:id/orcamento`: cria um rascunho vazio, uma única vez.
- `PUT /api/orcamentos/:id`: salva cabeçalho e itens usando controle de versão.
- `GET /api/projetos?telefone=...`: projetos do cliente.
- `POST /api/projetos`: cria projeto com `telefone`.
- `GET /api/projetos/:id/mensagens?telefone=...`: histórico e estado do projeto.
- `POST /api/mensagem`: recebe `telefone`, `mensagem`, `projeto_id`; retorna `resposta`, `cliente`, `projeto`, `pendencias`.

Sem projeto explícito, a API só continua automaticamente quando há no máximo um projeto. Com vários, retorna 409. IDs de outro cliente retornam 404. Erros da API, inclusive rotas inexistentes e JSON inválido, retornam JSON legível.

## Testes

Backend com banco e modelo reais:

```powershell
cd C:\Users\thepi\marceneiro-ia\backend
$env:TEST_DATABASE = '1'
$env:TEST_OLLAMA = '1'
npm.cmd test
```

Sem essas variáveis, os testes de integração opcionais são pulados. O teste direto do Ollama exige o modelo instalado e pode falhar se o serviço não responder dentro de 30 segundos. A indisponibilidade também é coberta por um teste simulado do fluxo de atendimento.

Frontend:

```powershell
cd C:\Users\thepi\marceneiro-ia\frontend
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

Os testes de banco criam registros dentro de transações externas revertidas ao terminar. Sequências de IDs podem avançar, o que é normal no PostgreSQL. O servidor opcional `backend/ui-test-server.js` permite QA na porta 3001 com reversão ao encerrar; ele é exclusivo para testes sequenciais, não para uso normal.

## Limites atuais

Esta revisão inclui coleta, painel, orçamento manual e abertura segura no WhatsApp; automação oficial de envio e produção continuam nas próximas etapas. A linguagem é guiada e deliberadamente previsível, não uma conversa irrestrita. Expressões não reconhecidas podem exigir reformulação. A IA continua sujeita a erro e não substitui a revisão do marceneiro.

Exclusão de informações por conversa, autenticação e garantia de envio único em falhas de rede ainda não estão implementadas. Se ocorrer timeout no navegador, recarregue o histórico antes de reenviar, para verificar se a mensagem já foi salva.
