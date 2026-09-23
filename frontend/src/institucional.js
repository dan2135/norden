/**
 * Conteúdo institucional e canais de contato apresentados no rodapé. Não é configuração de autenticação nem contém credenciais.
 */
// Canais oficiais compartilhados pelo painel e pela página pública.
export const contatoNorden = {
  email: 'norden0910@gmail.com',
  whatsapp: '5511939088948', // Número completo com código do país, somente dígitos.
  whatsappFormatado: '+55 (11) 93908-8948',
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
  privacidade: { titulo: 'Política de privacidade', blocos: [
    ['Dados que usamos', 'A Norden pode tratar dados do cadastro, como nome, e-mail, CPF ou CNPJ, além dos dados da empresa. Também são tratados clientes, conversas, projetos, orçamentos e informações enviadas pelo WhatsApp quando a integração estiver ativa.'],
    ['Como usamos esses dados', 'Usamos as informações para criar e proteger a conta, organizar atendimentos, apresentar o histórico de cada projeto, preparar orçamentos, processar assinaturas e oferecer suporte.'],
    ['Compartilhamento necessário', 'Os dados só são compartilhados quando isso for necessário para operar a Norden, como com os serviços de hospedagem, e-mail, pagamento e integração de mensagens. Cada serviço recebe somente o necessário para executar sua função.'],
    ['Segurança e acesso', 'O acesso ao painel depende de login. As senhas não ficam visíveis para a Norden, e cada empresa acessa apenas os próprios dados autorizados. Também adotamos medidas para reduzir acessos indevidos e usos não autorizados.'],
    ['Cookies e preferências', 'Usamos um cookie essencial para manter sua sessão segura enquanto você estiver conectado. O navegador também pode salvar, somente neste dispositivo, a preferência de tema e a última empresa selecionada. A Norden não usa cookies de publicidade.'],
    ['Prazo de guarda', 'Os dados ficam guardados enquanto a conta estiver ativa e forem necessários para prestar o serviço. Após um pedido de encerramento ou exclusão, os dados serão eliminados ou anonimizados em até 30 dias, exceto quando a guarda for necessária para cumprir obrigação legal, cobrança, segurança ou prevenção a fraudes.'],
    ['Pedidos sobre dados pessoais', 'Para solicitar acesso, correção ou exclusão de dados, envie um e-mail para norden0910@gmail.com com o assunto “Dados pessoais Norden” e informe o e-mail usado na conta. Para sua proteção, a Norden poderá confirmar sua identidade antes de responder. Não envie senhas, códigos de acesso ou dados de cartões na mensagem.'],
    ['Responsável e atualização deste texto', 'A Norden é responsável pelo tratamento dos dados dentro da plataforma. Enquanto a empresa estiver em formalização, o contato para assuntos de privacidade é norden0910@gmail.com. Este texto será atualizado com a razão social e o CNPJ quando estiverem definidos.'],
  ] },
  termos: { titulo: 'Termos de uso', blocos: [
    ['Finalidade da plataforma', 'A Norden ajuda empresas a organizar atendimentos, clientes, projetos, conversas e orçamentos. O usuário deve utilizar a plataforma apenas em atividades legítimas e relacionadas ao seu negócio.'],
    ['Conta e acesso', 'Informe dados corretos, mantenha a senha em sigilo e use somente contas para as quais você tem autorização. O responsável pela empresa deve definir quem pode acessar cada conta.'],
    ['Uso das informações', 'Quem utiliza a Norden é responsável por ter autorização para registrar dados de clientes, conversas e projetos. Não envie informações desnecessárias ou conteúdo que viole direitos de terceiros.'],
    ['Suzy e orçamentos', 'A Suzy auxilia na organização das conversas. Medidas, materiais, preços, prazos e qualquer proposta comercial devem ser conferidos pelo responsável da empresa antes do envio ao cliente ou do início da produção.'],
    ['Plano e pagamento', 'A Norden oferece 15 dias gratuitos para conhecer a plataforma. Depois desse período, o plano profissional custa R$ 110 por mês quando a assinatura for ativada. As condições de cobrança serão apresentadas antes da confirmação do pagamento.'],
    ['Suporte e disponibilidade', 'O suporte é oferecido pelo e-mail norden0910@gmail.com. A plataforma pode receber atualizações, correções e períodos de manutenção para melhorar a segurança e o funcionamento.'],
    ['Revisão antes do lançamento comercial', 'Estes termos serão revisados quando os dados cadastrais da empresa, o domínio próprio e o canal comercial de suporte estiverem definidos.'],
  ] },
};
