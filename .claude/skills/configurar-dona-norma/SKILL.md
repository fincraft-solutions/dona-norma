---
name: configurar-dona-norma
description: Parametrizar e colocar no ar a Dona Norma (tira-dúvidas fiscal do Wavern). Use para ajustar personagem e tom, escolher modelo e custo, configurar a chave da API, o limite de uso gratuito, o CORS do site, o convite (CTA) e para embutir o chat no site.
---

# Configurar a Dona Norma

## 1. Chave e variáveis

1. Copie `.env.example` para `.env` (o `.env` não vai para o Git).
2. Preencha `ANTHROPIC_API_KEY` com uma chave do Console da Anthropic. Em produção, use o cofre de segredos da hospedagem (Supabase Secrets, variáveis do servidor), nunca o código.
3. Revise as demais variáveis. Todas têm valor padrão em `src/config.ts`.

| Variável | Para quê | Padrão |
|---|---|---|
| `DONA_NORMA_MODELO` | Modelo das respostas | `claude-opus-5-5` |
| `DONA_NORMA_ESFORCO` | Profundidade do raciocínio (`low`, `medium`, `high`, `xhigh`, `max`) | `low` |
| `DONA_NORMA_MAX_TOKENS` | Teto de saída por resposta | `4000` |
| `DONA_NORMA_CTA_URL` | Link do convite quando não há base | `https://wavern.com.br` |
| `DONA_NORMA_EXIGIR_BASE_VERIFICADA` | Recusa iniciar com documento não verificado (aceita `true`, `1`, `sim`, `yes`) | `false` (use `true` em produção) |
| `DONA_NORMA_COBERTURA_MINIMA` | Fração do texto que precisa estar coberta por citações (0 a 1) | `0.35` |
| `DONA_NORMA_PORTA` | Porta do servidor HTTP | `8787` |
| `DONA_NORMA_CORS_ORIGEM` | Sites autorizados a chamar a API, separados por vírgula | `https://wavern.com.br` |
| `DONA_NORMA_LIMITE_POR_HORA` | Perguntas por IP por hora (só contam as que chegam à API) | `20` |
| `DONA_NORMA_CONFIAR_PROXY` | Atrás de proxy: usar o último IP do `X-Forwarded-For` no limite | `false` |

## 2. Custo (versão gratuita)

- Cada pergunta é **uma** chamada à API. A base legal vai em toda chamada, com cache (`cache_control` no último documento): quando o cache é aproveitado, essa parte custa cerca de 5% do preço de entrada no Opus 5.5 (10% no Sonnet 5.5). O cache só vale a partir de um tamanho mínimo de prompt (alguns milhares de tokens, conforme o modelo); com a base inicial, pequena, pode não haver economia até ela crescer.
- A escolha de modelo é de negócio: `claude-opus-5-5` é o padrão; `claude-haiku-5-5` custa muito menos por token. Antes de trocar, rode `npm run avaliar -- --confirmar` nos dois e compare a taxa de acerto.
- Com `claude-haiku-5-5` o código desliga sozinho o fallback de servidor (`suportaFallback` em `src/config.ts`).
- Acompanhe `usage.cache_read_input_tokens` nas respostas: se ficar zerado, algo está mudando o início da requisição (por exemplo, a ordem dos arquivos da base).

## 3. Personagem e tom

O texto da personagem está em `prompts/sistema.md`. Para mudar o jeito de falar:

- Edite a seção "Quem você é". Mantenha as regras de "Como responder", principalmente "responda apenas com base nos documentos".
- A pergunta chega ao modelo entre as tags `<pergunta_do_usuario>`; mantenha a regra do prompt que trata esse conteúdo como dado, não como instrução.
- A resposta só é aceita se terminar normalmente (`end_turn`) e se pelo menos `DONA_NORMA_COBERTURA_MINIMA` do texto estiver em trechos citados. Se o novo tom fizer o modelo escrever mais texto livre, a avaliação vai mostrar mais encaminhamentos: ajuste o prompt antes de baixar a cobertura.
- Depois de qualquer mudança no prompt, rode a avaliação. Mudança de tom costuma afetar a taxa de citação.

## 4. Colocar no ar

Opção A, servidor Node (mais simples):

```bash
npm install
npm run servidor        # POST http://localhost:8787/perguntar  {"pergunta": "..."}
```

A resposta é JSON: `{ texto, fontes: [{ id, fonte, url, trecho }], semBase, modelo }`. Mostre as `fontes` abaixo do texto e, quando `semBase` for `true`, destaque o convite.

Códigos de resposta: `200` resposta (ou encaminhamento, com `semBase: true`); `400` pergunta vazia, longa demais (mais de 1000 caracteres) ou JSON inválido; `405` método diferente de POST; `413` corpo acima de 16 KiB; `429` limite por hora; `502` a API do Claude falhou ou a credencial está errada (sem detalhes no corpo; o detalhe fica no log). O servidor avisa na partida se não houver credencial.

Opção B, Supabase Edge Function (mesmo stack do Wavern): crie a função, importe `responder` de `src/dona-norma.ts` e o SDK como `npm:@anthropic-ai/sdk`, troque a leitura de arquivos de `src/base.ts` e `PROMPT_SISTEMA` por conteúdo embutido no build ou lido de uma tabela, e guarde a chave com `supabase secrets set ANTHROPIC_API_KEY=...`.

O limite por IP (`src/limitador.ts`) fica em memória, limpa as janelas expiradas e guarda no máximo 50 mil clientes; IPv6 é agrupado por /64. Atrás de proxy, ligue `DONA_NORMA_CONFIAR_PROXY=true`, senão todos os usuários contam como um só. Com mais de uma instância, troque por um contador compartilhado (Redis ou tabela no Supabase).

## 5. Antes de publicar

- [ ] Base legal toda verificada (`npm run verificar-base -- --estrito` sem erro).
- [ ] `DONA_NORMA_EXIGIR_BASE_VERIFICADA=true`.
- [ ] Avaliação com taxa de acerto aceitável e nenhuma resposta inventada nas perguntas `null`.
- [ ] Aviso no site: "Informação geral, não substitui a orientação de um contador."
- [ ] CORS restrito ao domínio do site.
