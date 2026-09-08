# Revisão do atendimento — 31/08/2026

## Adição do passo 14.5 — base multiempresa

A migração 005 criou marcenarias e vinculou clientes, projetos, mensagens, orçamentos e catálogo à empresa proprietária. Os registros anteriores foram associados à **Marcenaria principal** sem exclusão. O telefone passou a ser único por empresa, não globalmente.

Foram executados **48 testes de backend com PostgreSQL real** (2 testes do Ollama pulados) e **14 testes de frontend**, além de lint e build. O cenário novo criou duas empresas com o mesmo telefone, manteve projetos e históricos distintos e confirmou 404 no acesso cruzado. Todos os dados desse teste foram revertidos.

O seletor atual existe para desenvolvimento e não será tratado como controle de acesso em produção. O próximo passo obrigatório é autenticação, sessão segura e associação do usuário à marcenaria.

## Adição do passo 14 — WhatsApp com confirmação

Foi adicionada a preparação da mensagem do orçamento para WhatsApp. O texto usa exclusivamente o orçamento salvo, normaliza celulares brasileiros, bloqueia telefone incompleto, orçamento fora de **Pronto para enviar** e alterações ainda não salvas. A aplicação abre `wa.me` em nova aba, mas não envia nem registra uma confirmação inexistente.

Passaram **14 testes de frontend**, além de lint e build. Foram cobertos número com DDD/código do país, telefone inválido, conteúdo e total fixo do orçamento e codificação segura da mensagem. Nenhuma mensagem externa foi enviada durante a validação.

## Adição do passo 13.1 — estimativa por catálogo

Foi criado um catálogo local com fornecedor, preço por embalagem, rendimento, unidade de consumo e data de atualização. O estimador usa as dimensões confirmadas, perdas explícitas de chapa e fita e ferragens inferidas do tipo de móvel. A prévia lista materiais ausentes e só entra no orçamento após confirmação do marceneiro.

A migração 004 foi aplicada sem inserir preços ou alterar registros existentes. Passaram **44 testes de backend** (4 integrações opcionais puladas) e **11 testes de frontend**, além de lint e build. Uma verificação isolada no PostgreSQL gerou uma estimativa real pela API; o catálogo de teste foi revertido ao encerrar.

## Adição do passo 13 — orçamento manual

Foi incluído um orçamento por projeto, com itens, quantidades de até três casas decimais, valores em reais, desconto fixo, validade, observações e situações manuais. Subtotal e total são calculados novamente no backend usando centavos; desconto acima do subtotal, números inválidos, data impossível e orçamento vazio fora de rascunho são rejeitados. O campo `versao` evita que duas telas sobrescrevam silenciosamente o mesmo orçamento.

A migração 003 foi aplicada com sucesso no PostgreSQL local e não alterou registros anteriores. Nesta etapa passaram **40 testes de backend** (4 integrações opcionais puladas) e **11 testes de frontend**, além de lint e build. Não foram cadastrados preços nem orçamentos de teste no banco do usuário.

O recurso de impressão usa a caixa de impressão do navegador e pode salvar em PDF. Nenhum orçamento é enviado ou aprovado automaticamente; WhatsApp continua no passo 14.

## Adição do passo 12 — painel local

Painel implementado com indicadores gerais, listas de clientes e projetos, busca sem distinção de acentos, filtros por cliente/situação, paginação e ficha com dados, pendências e histórico. Navegação entre painel e atendimento mantém o chat montado para preservar o rascunho.

Validação desta etapa: **37 testes de backend e 8 testes de frontend passaram**, além de build e lint. Os dois testes opcionais que dependem do Ollama não foram executados nesta etapa, que não altera o modelo nem as regras do atendimento. Os testes novos da API usaram PostgreSQL real, registros transacionais revertidos, cliente sem projeto, prioridades de situação, isolamento do histórico e confirmação de que consultar o painel não altera projetos. Origens de páginas externas foram bloqueadas nas novas rotas.

A prévia local respondeu com HTTP 200 e indicadores do banco. Não foi realizada uma nova sessão de testes interativos no navegador nesta etapa. A arquitetura local existente foi preservada; não houve publicação, alteração destrutiva ou migração de banco adicional.

**Dados completos** é uma indicação da coleta, não orçamento aprovado. O painel é somente leitura. A aplicação continua sem autenticação e não deve ser exposta à internet.

## Resultado

- Backend: **33 testes passaram**, sem testes pulados, com PostgreSQL e Ollama habilitados.
- Frontend: **4 testes passaram**; build e lint passaram.
- Navegador: criação de projeto, coleta do móvel, medidas sem unidade, recarregamento com pendências, confirmação por “sim”, registro do ambiente, novo projeto vazio e retorno ao anterior verificados.
- Contraste e aparência conferidos visualmente na tela de atendimento.

## Correções principais

O fluxo de coleta agora determina a próxima pergunta pelos dados confirmados, em vez de usar diretamente a resposta livre do modelo. Dados rejeitados da IA são registrados como descartes técnicos; não fazem o cliente repetir o móvel que já informou.

Medidas sem unidade são armazenadas separadamente como pendências, sem aparecer como medidas confirmadas. A confirmação de unidade sobrevive ao recarregamento da página. Correções parciais preservam as outras dimensões. A interpretação percorre as medidas da esquerda para a direita para não atribuir o mesmo número a duas dimensões adjacentes.

Os logs locais voltaram a mostrar nome/cliente, projeto, mensagem, campos salvos, pendências e resposta. A tela mostra os dados registrados, informa erros de conexão em português e detecta backend antigo. A inicialização aplica as migrações e monitora alterações no código.

## Cenários de falha testados

- Extração malformada ou inventada não substitui dados confirmados.
- IA indisponível não impede o atendimento guiado.
- Falha de gravação reverte mensagens, alterações de projeto e estado da coleta.
- Projetos de outro cliente, mensagens inválidas, JSON malformado e rotas inexistentes recebem erros apropriados.
- Histórico e pendências não são transferidos entre projetos.
- Erro HTML do backend não aparece como “Unexpected token” na tela.

## Observações

O primeiro carregamento observado do Ollama levou cerca de 19 segundos. O limite de extração foi ajustado para 30 segundos; depois do carregamento, o teste real do modelo passou. O fluxo comum não precisa desse carregamento.

Os testes foram executados com registros transacionais descartáveis. Clientes, projetos e histórico existentes não foram apagados. As sequências de IDs podem apresentar lacunas por causa dos testes revertidos.

Esta é uma revisão dos fluxos existentes, não uma garantia de ausência de bugs. A coleta é guiada; frases não reconhecidas ainda podem exigir reformulação. A aplicação permanece local, sem autenticação, orçamento automático ou integração com WhatsApp. Dados antigos rejeitados não são reinterpretados automaticamente. A versão antiga já aberta no CMD precisa ser reiniciada uma vez para ativar as mudanças.
