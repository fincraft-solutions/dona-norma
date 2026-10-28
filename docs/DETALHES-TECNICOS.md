> Language: [English](en/guide.md) | [Português (Brasil)](pt-BR/guide.md)

# Dona Norma

Tira-dúvidas fiscal de MEI e Simples Nacional do Wavern. Responde em linguagem simples e **sempre cita a fonte oficial**. Quando não tem base legal para responder, encaminha para um contador em vez de inventar.

> "MEI pode ter funcionário?"
> **Dona Norma:** Sim. Até o fim de 2026, um empregado; a partir de 2027, até dois, cada um recebendo um salário mínimo ou o piso da categoria.
> **Fonte:** LC 123/2006, art. 18-C, com a redação da LC 238/2026


## Como funciona

1. A base legal (`base-legal/*.md`) vai em toda pergunta como documentos citáveis (Citations da API do Claude), com cache de prompt para custar pouco.
2. O Claude responde citando trechos desses documentos.
3. O código só aceita a resposta se ela terminar normalmente e se **boa parte do texto estiver em trechos citados** (`DONA_NORMA_COBERTURA_MINIMA`, padrão 35%). Sem citação, com citação solta carimbando texto livre, resposta cortada, recusa do modelo ou pergunta fora do tema, a resposta é trocada pelo encaminhamento ao contador (`interpretarResposta` em `src/dona-norma.ts`).
4. A pergunta vai ao modelo entre as tags `<pergunta_do_usuario>`, tratada como dado e não como instrução.

Uma chamada à API por pergunta, sem ferramentas e sem dados da empresa.

## Começar

```bash
npm install
cp .env.example .env          # preencha ANTHROPIC_API_KEY
npm test                      # testes sem custo (cliente falso)
npm run perguntar -- "MEI pode ter funcionário?"
npm run servidor              # POST http://localhost:8787/perguntar {"pergunta": "..."}
                              # 400 pergunta inválida · 413 corpo grande · 429 limite · 502 falha da API
```

Requer Node 22.20 ou superior (roda TypeScript direto, sem build).

## Skill portátil (Claude, ChatGPT, Gemini)

`npm run empacotar-skill` monta `dist/dona-norma/` e `dist/dona-norma.zip` (gerados localmente; não versionados) a partir de `skill/SKILL.md` e da `base-legal/`, no padrão Agent Skills. Veja como usar em [README principal](../README.md).

## Parametrização

| O quê | Onde | Skill |
|---|---|---|
| Chave, modelo, esforço, limite por IP, CORS, link do convite | `.env` (modelo em `.env.example`) | `configurar-dona-norma` |
| Personagem e tom | `prompts/sistema.md` | `configurar-dona-norma` |
| Conteúdo legal | `base-legal/*.md` | `atualizar-base-legal` |
| Casos de avaliação | `avaliacao/perguntas.json` | `atualizar-base-legal` |

As skills ficam em `.claude/skills/` e são carregadas pelo Claude Code quando esta pasta é a raiz do projeto.

## Estrutura

```
src/
  dona-norma.ts     núcleo: monta a requisição, interpreta citações, regra "sem citação, sem resposta"
  base.ts           leitura e validação da base legal
  config.ts         variáveis de ambiente e modelos com fallback
  iniciar.ts        junta config + base + cliente e aplica a trava de base verificada
  cli.ts            npm run perguntar
  servidor.ts       API HTTP mínima para embutir no site (nunca cai por erro de uma requisição)
  limitador.ts      limite de perguntas por cliente, com expiração, teto de memória e suporte a proxy
  verificar-base.ts status de verificação de cada documento
  avaliar.ts        roda as perguntas de avaliação contra a API (custo real, exige --confirmar)
prompts/sistema.md  personagem e regras de resposta
base-legal/         um documento por assunto
avaliacao/          perguntas com a fonte esperada
test/               testes com cliente falso
```

## Antes de usar em produção

- **A base legal inicial é um resumo não verificado.** Confira cada documento contra a fonte oficial e preencha `verificado_em` (`npm run verificar-base`). Em produção, use `DONA_NORMA_EXIGIR_BASE_VERIFICADA=true`.
- Rode `npm run avaliar -- --confirmar` e confira a taxa de acerto.
- Mostre no site o aviso "Informação geral, não substitui a orientação de um contador".
