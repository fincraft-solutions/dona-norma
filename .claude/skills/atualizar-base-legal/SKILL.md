---
name: atualizar-base-legal
description: Adicionar, corrigir ou verificar documentos da base legal da Dona Norma (pasta base-legal/). Use quando a lei mudar (ex. novo limite do MEI), quando surgir pergunta frequente sem resposta, ou antes de publicar, para conferir os textos contra a fonte oficial e preencher verificado_em.
---

# Atualizar a base legal da Dona Norma

A Dona Norma só responde o que consegue **citar** da pasta `base-legal/`. Sem citação, o código troca a resposta pelo encaminhamento ao contador (`src/dona-norma.ts`, `interpretarResposta`). Então a qualidade dela é a qualidade desta base.

## Formato de cada documento

Um arquivo `.md` por assunto, com cabeçalho:

```
---
id: mei-empregado                 # único, em kebab-case
titulo: MEI pode contratar empregado
fonte: LC 123/2006, art. 18-C     # aparece para o usuário como "Fonte"
url: https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm
verificado_em: 2026-10-24         # vazio = não verificado
---
Texto do dispositivo.
```

Arquivos que começam com `_` e subpastas são ignorados (notas internas). Arquivos salvos com CRLF ou BOM são aceitos. Uma base sem nenhum documento é erro.

## Passo a passo

1. **Achar a fonte oficial.** Use sempre a fonte primária: Planalto (leis complementares), Receita Federal / Portal do Simples Nacional (resoluções CGSN), Portal do Empreendedor. Não use blogs nem sites de contabilidade como fonte.
2. **Transcrever, de preferência literalmente.** Copie o texto vigente do dispositivo (sem trechos revogados). Se precisar resumir para ficar legível, comece o texto com "Resumo:" e mantenha números, prazos e condições exatamente como na lei.
3. **Um assunto por arquivo.** Documentos curtos geram citações precisas. Se um artigo trata de três coisas, divida em três arquivos com o mesmo `fonte`.
4. **Preencher `verificado_em`** com a data em que uma pessoa conferiu o texto contra a fonte. Só uma pessoa pode fazer isso; um agente pode preparar, mas deve deixar o campo vazio e listar o que precisa ser conferido. O campo só aceita uma data real no formato `AAAA-MM-DD`, que não esteja no futuro; qualquer outro texto ("sim", "AAAA-MM-DD") faz a base recusar carregar, para não burlar a trava.
5. **Rodar a checagem:** `npm run verificar-base` (lista o status). Em produção, use `DONA_NORMA_EXIGIR_BASE_VERIFICADA=true` para a Dona Norma recusar iniciar com pendências.
6. **Adicionar casos de avaliação** em `avaliacao/perguntas.json`: pelo menos duas perguntas reais por documento novo, com `fonteEsperada` igual ao `id`. Inclua também perguntas que **não** devem ser respondidas (`fonteEsperada: null`).
7. **Medir:** `npm test` (grátis) e `npm run avaliar -- --confirmar` (chama a API, custo real; avise quem paga antes de rodar).

## Quando a lei muda

- Atualize o texto, a `fonte` (ex. nova redação dada por outra lei) e limpe `verificado_em` até alguém conferir.
- Procure o valor antigo em todo o repositório (ex. `81.000`, `6.750`, `97.200`) para não deixar documento desatualizado.
- Se os outros agentes estiverem no mesmo projeto, atualize também `em-dia/dados/parametros.json` e `pente-fino/dados/parametros.json` (tabela `limitesMei`, por ano).
- Mudanças com data de efeito futura (como a LC 238/2026, que muda o limite em 2027 e em 2028) devem dizer no texto a partir de quando cada valor vale.

## Checklist da versão inicial

A base foi criada como **resumo não verificado**. Antes de publicar, confira pelo menos:

- [ ] Limite do MEI por ano: R$ 81.000 até 2026, R$ 110.000 em 2027 e R$ 140.000 a partir de 2028 (LC 238/2026, de 21/10/2026), e os proporcionais (R$ 6.750, R$ 9.166,67 e R$ 11.666,67 por mês).
- [ ] Número de empregados do MEI: 1 até 2026 e até 2 a partir de 2027 (LC 238/2026).
- [ ] Regras de excesso de faturamento do MEI (até 20% e acima de 20%) e parágrafos citados.
- [ ] Composição do DAS do MEI (5% do salário mínimo + R$ 1 de ICMS + R$ 5 de ISS).
- [ ] Artigos da Resolução CGSN 140/2018 para DASN-SIMEI e DEFIS, e a URL exata da norma.
- [ ] Parágrafos do Fator R (art. 18, §§ 5º-J e 5º-M).
