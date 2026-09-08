# Revisão dos achados GitGuard — 2026-09-08

Relatório recebido: scan `cmtt313qc000vitgsbe5gujv5`, referente ao commit `b1a64ede9628`.

## Limitação do relatório

Os 100 itens selecionados incluem 89 registros informativos de inventário SBOM e 11 alertas SAST: oito sobre regex/ReDoS, dois sobre regex dinâmica e um sobre CSRF. Não há localização, evidência ou trecho de código. Portanto, esta revisão trata os mecanismos identificados no código, mas não atesta correspondência individual nem resolução de todos os achados de um scan completo. É necessária nova análise do GitGuard com localização para fechar o acompanhamento.

## Alterações

- `coleta.js` e `dados-projeto.js`: expressões dinâmicas substituídas por literais; números e espaços delimitados nos principais parsers de medidas. Os padrões anteriores usavam constantes internas, não interpolação direta de entrada do cliente, mas a construção dinâmica foi eliminada.
- `seguranca.js`: limite de 10 mil caracteres e varredura linear para recusar sequências de mais de 32 dígitos ou espaços antes dos parsers de coleta, medidas, complemento e estimativa. Não há truncamento silencioso dessas mensagens.
- `extracao.js`: reconhecimento da continuação ambiente/característica por varredura de palavras em vez da expressão com múltiplas capturas e repetições ambíguas.
- `auth.js` e `email.js`: validação de e-mail por operações de string e limite prévio de comprimento. Documento também é limitado antes da normalização.
- `server.js`: middleware de origem bloqueia alterações de sites não autorizados e requisições cross-site sem origem. Rotas públicas de autenticação exigem JSON, impedindo submissões simples de formulário. O token CSRF vinculado à sessão, cookies HttpOnly e SameSite permanecem ativos. Não foi adicionado o pacote legado `csurf`: ausência desse pacote não significa ausência de proteção.
- `qs` atualizado de 6.15.3 para 6.16.0 pelo lockfile, dentro da faixa já aceita pelas dependências. Auditorias npm de backend e frontend retornaram zero vulnerabilidades conhecidas nesta data.

## Verificação

- Backend: 62 testes passaram; oito testes dependentes de integrações são omitidos no comando padrão.
- Frontend: 15 testes passaram, assim como lint e build.
- Três testes adicionais com PostgreSQL passaram: isolamento/lixeira, multissetor e fila de e-mails. Dados temporários revertidos e transporte SMTP simulado; nenhum e-mail real foi enviado.
- Novos testes cobrem rejeição de entradas adversariais em subprocesso com prazo máximo, origem hostil, tipo de conteúdo inadequado, origem permitida, token CSRF ausente/incorreto e token válido.
- Os testes não substituem uma varredura completa nem garantem ausência de vulnerabilidades. Não foram feitas alterações de contas, senhas ou publicação em nuvem.

Referências: [OWASP — ReDoS](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS) e [OWASP — prevenção de CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
