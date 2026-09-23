/**
 * Conteúdo institucional e canais de contato apresentados no rodapé. Não é configuração de autenticação nem contém credenciais.
 */
// Canais oficiais compartilhados pelo painel e pela página pública.
export const contatoNorden = {
  email: 'norden0910@gmail.com',
  whatsapp: '5511919988939', // Número completo com código do país, somente dígitos.
  whatsappFormatado: '+55 (11) 91998-8939',
};

export const paginasInstitucionais = {
  sobre: { titulo: 'Sobre a Norden', blocos: [
    ['Feita para acompanhar cada projeto', 'A Norden reúne clientes, conversas, informações dos projetos e orçamentos para facilitar a rotina de empresas de diferentes ramos.'],
    ['Conheça a Suzy', 'A Suzy é nossa assistente virtual. Ela se apresenta em nome da empresa cadastrada, conversa pelo WhatsApp quando a integração está ativa e ajuda a organizar as informações do pedido. O profissional responsável confere as medidas, os materiais, os valores e os prazos.'],
  ] },
  ajuda: { titulo: 'Central de ajuda', blocos: [
    ['Como excluir ou recuperar clientes e projetos?', 'Nas listas do Painel, clique em Excluir para mover um registro para sua lixeira. Em Lixeira de clientes ou Lixeira de projetos, use Restaurar para recuperá-lo. Projetos excluídos separadamente permanecem na própria lixeira ao restaurar o cliente.'],
    ['Como apagar definitivamente?', 'Na lixeira, clique em Excluir permanentemente e informe a senha da sua conta para confirmar. Um projeto é apagado com suas mensagens e orçamento, mantendo o cliente e os outros projetos. Ao apagar um cliente, todos os seus projetos, mensagens e orçamentos são apagados, inclusive os já na lixeira. Essa ação não pode ser desfeita pela plataforma.'],
    ['Como começar um projeto?', 'Escolha a empresa no topo do painel. Quando o WhatsApp estiver conectado, o cliente conversa com a Suzy pelo número comercial e o histórico aparece no Painel. As perguntas seguem o ramo escolhido no cadastro da empresa.'],
    ['Como informar medidas ou detalhes técnicos?', 'Quando o pedido depender de medidas, informe largura, altura, profundidade, quantidade ou unidade com clareza, por exemplo: largura 80 cm, altura 90 cm, barra de 6 m ou caixa com 100 unidades. Confira os dados salvos antes de continuar.'],
    ['Onde vejo o histórico?', 'No Painel, encontre o projeto e abra sua ficha para consultar os dados e as mensagens. Use os filtros para localizar clientes, pedidos e situações da coleta.'],
    ['A estimativa já é o preço final?', 'Não. Quando houver estimativa automática disponível para o ramo, ela serve apenas como referência. Nos demais casos, preencha o orçamento manualmente. Confira materiais, perdas, mão de obra, transporte e demais custos antes de salvar e apresentar o orçamento.'],
    ['Como recuperar a senha?', 'Na tela de login, clique em Esqueci minha senha e informe o e-mail cadastrado. Nesta fase local, as mensagens são simuladas; o envio real ainda precisa ser configurado.'],
    ['O WhatsApp já responde sozinho?', 'Sim. Depois que o número comercial for conectado, a Suzy pode organizar as conversas e o histórico fica disponível no Painel para conferência antes de qualquer orçamento ou produção.'],
  ] },
  privacidade: { titulo: 'Privacidade', rascunho: true, blocos: [
    ['Dados usados nesta versão', 'O cadastro registra nome, e-mail, CPF ou CNPJ e informações da empresa. As conversas pelo WhatsApp, clientes, projetos e orçamentos ficam vinculados ao painel. O login registra o último IP e a data de acesso.'],
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
