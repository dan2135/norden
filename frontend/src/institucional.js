/**
 * Conteúdo institucional e canais de contato apresentados no rodapé. Não é configuração de autenticação nem contém credenciais.
 */
// Preencher com os canais oficiais da Norden antes da publicação.
export const contatoNorden = {
  email: '',
  whatsapp: '', // Número completo com código do país, somente dígitos.
};

export const paginasInstitucionais = {
  sobre: { titulo: 'Sobre a Norden', blocos: [
    ['Feita para acompanhar cada projeto', 'A Norden reúne clientes, conversas, informações dos projetos e orçamentos para facilitar a rotina de empresas de diferentes ramos.'],
    ['Conheça a Suzy', 'A Suzy é nossa assistente virtual. Ela se apresenta em nome da empresa cadastrada e ajuda a organizar as informações do atendimento. O profissional responsável confere as medidas, os materiais, os valores e os prazos.'],
  ] },
  ajuda: { titulo: 'Central de ajuda', blocos: [
    ['Como excluir ou recuperar clientes e projetos?', 'Nas listas do Painel, clique em Excluir para mover um registro para sua lixeira. Em Lixeira de clientes ou Lixeira de projetos, use Restaurar para recuperá-lo. Projetos excluídos separadamente permanecem na própria lixeira ao restaurar o cliente.'],
    ['Como apagar definitivamente?', 'Na lixeira, clique em Excluir permanentemente e informe a senha da sua conta para confirmar. Um projeto é apagado com suas mensagens e orçamento, mantendo o cliente e os outros projetos. Ao apagar um cliente, todos os seus projetos, mensagens e orçamentos são apagados, inclusive os já na lixeira. Essa ação não pode ser desfeita pela plataforma.'],
    ['Como começar um projeto?', 'Escolha a empresa no topo do painel. Abra Atendimento e clique em Novo projeto. Conte à Suzy o que precisa. As perguntas seguem o ramo escolhido no cadastro da empresa.'],
    ['Como informar medidas na marcenaria?', 'No ramo de marcenaria, informe largura, altura e profundidade com a unidade, por exemplo: largura 80 cm, altura 90 cm e profundidade 40 cm. Confira os dados salvos antes de continuar.'],
    ['Onde vejo o histórico?', 'No Painel, encontre o projeto e abra sua ficha para consultar os dados e as mensagens. Use os filtros para localizar clientes, pedidos e situações da coleta.'],
    ['A estimativa já é o preço final?', 'Não. A estimativa automática está disponível para marcenaria. Nos outros ramos, preencha o orçamento manualmente. Ela usa os preços cadastrados e as regras de consumo do sistema. Confira materiais, perdas, ferragens, mão de obra e demais custos antes de salvar e apresentar o orçamento.'],
    ['Como recuperar a senha?', 'Na tela de login, clique em Esqueci minha senha e informe o e-mail cadastrado. Nesta fase local, as mensagens são simuladas; o envio real ainda precisa ser configurado.'],
    ['O WhatsApp já responde sozinho?', 'Ainda não. O recurso atual prepara o compartilhamento do orçamento. O atendimento automático da Suzy no WhatsApp está em desenvolvimento.'],
  ] },
  privacidade: { titulo: 'Privacidade', rascunho: true, blocos: [
    ['Dados usados nesta versão', 'O cadastro registra nome, e-mail, CPF ou CNPJ e informações da empresa. O atendimento registra dados dos clientes, conversas, projetos e orçamentos. O login registra o último IP e a data de acesso.'],
    ['Finalidades', 'Essas informações permitem organizar os atendimentos, vincular usuários às empresas, preparar orçamentos, autenticar acessos e apoiar a recuperação de conta.'],
    ['Acesso e armazenamento', 'Os registros ficam no banco configurado para o sistema. Usuários comuns acessam suas empresas autorizadas; o superadministrador possui acesso a todas. Senhas são armazenadas como hash. Nesta versão local, e-mails simulados e links de recuperação também ficam registrados no banco e no terminal.'],
    ['Cookies e preferências', 'Um cookie mantém a sessão autenticada. O navegador também guarda a preferência de empresa selecionada.'],
    ['Informações a completar antes da publicação', 'Faltam a identificação do responsável pelo tratamento, o canal de contato, os prazos de retenção, as bases legais aplicáveis, os fornecedores de hospedagem e e-mail e o procedimento para solicitações sobre dados. Este texto ainda não é a política definitiva.'],
  ] },
  termos: { titulo: 'Termos de uso', rascunho: true, blocos: [
    ['Finalidade da plataforma', 'A Norden oferece ferramentas para organizar atendimentos, clientes, projetos e orçamentos de empresas. Esta versão está em desenvolvimento.'],
    ['Conta e acesso', 'Use informações corretas no cadastro, mantenha sua senha em sigilo e acesse apenas os dados para os quais possui autorização.'],
    ['Revisão profissional', 'As respostas da Suzy e as estimativas auxiliam o trabalho. Medidas, materiais, preços e prazos precisam ser conferidos pelo responsável antes de uma proposta ou produção.'],
    ['Informações a completar antes da publicação', 'A identificação da empresa, os canais de suporte, as condições comerciais, as regras de cancelamento, as responsabilidades e as condições de disponibilidade ainda precisam ser definidas e revisadas. Não há aceite contratual vinculado a este rascunho.'],
  ] },
};
