# Suzy com OpenAI

Em `backend/.env` (não no `.env.example` nem no frontend), configure:

```dotenv
IA_PROVIDER=openai
OPENAI_MODEL=gpt-4.1-mini
OPENAI_API_KEY=""
```

Crie sua chave na plataforma OpenAI, configure a cobrança da API e coloque a chave entre aspas somente no arquivo privado. Reinicie o backend após salvar.
Não envie a chave pelo chat, GitHub ou capturas de tela. Sem chave, a integração não foi validada em uma chamada real.

## Comportamento

- As regras existentes continuam decidindo os dados e a próxima pergunta. A OpenAI reformula a resposta para todos os ramos; não substitui o fluxo de coleta por um agente autônomo.
- Na marcenaria, a extração complementar também pode usar a OpenAI com JSON estruturado e validação da evidência.
- Somente as últimas oito mensagens (até 2.000 caracteres cada), nome/ramo da empresa e resposta-base são enviados para gerar o texto. A extração envia a mensagem atual e a pergunta anterior.
- Conteúdo digitado pelo cliente pode conter dados pessoais: informe esse processamento em sua política de privacidade antes do lançamento.
- `store:false` desativa armazenamento da resposta para recuperação pela API; não equivale a garantia de retenção zero pelo fornecedor.
- Cada chamada tem limite de saída e tempo de 12 segundos; não há repetição automática. Uma mensagem pode usar duas chamadas. Isso limita consumo por chamada, não é teto mensal de cobrança.
- Erros, recusas e respostas incompletas mantêm a resposta guiada. `modo_ia` identifica `openai`, `contingencia` ou `regras` na resposta HTTP.
- Revisão humana continua necessária: instruções ao modelo não garantem ausência de erros ou invenções.

Sem `IA_PROVIDER=openai`, mantém-se o modo anterior (Ollama para extração e respostas por regras).
A integração não publica o backend nem conecta o WhatsApp automaticamente.

Referências: https://developers.openai.com/api/docs/guides/structured-outputs e https://developers.openai.com/api/docs/quickstart.
