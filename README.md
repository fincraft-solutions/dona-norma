# Dona Norma

```text
   ___  __________
  |   ||   _____ /   FINCRAFT
  |___||  |____/    OPEN LAB
       |  |
       |__|
```

**Quando a pergunta é tributária, um palpite convincente não basta.**


Um protótipo de assistente para dúvidas recorrentes de MEI e Simples Nacional. Em vez de responder de memória, procura sustentação em uma base documental local e indica suas fontes. Quando a evidência não basta, o caminho é **não fechar a resposta**.

> **Estado:** prévia técnica. A base legal ainda precisa de revisão humana, por competência e vigência. Não é consulta contábil nem resposta tributária homologada.

## O que vale experimentar

Pergunte: **“MEI pode contratar um empregado?”** A pergunta serve para observar como o assistente seleciona evidências, cita fontes e decide quando deve encaminhar o caso. Não use uma eventual resposta como orientação profissional sem verificar a legislação atual.

```bash
# Node.js 22.20+; instale dependências a partir do lockfile
npm ci
npm run typecheck
npm test

# Inspecione a base ANTES de chamar um modelo externo
npm run verificar-base

# Somente depois de configurar sua chave em .env:
cp .env.example .env
npm run perguntar -- "MEI pode contratar um empregado?"
```

O último comando chama uma API externa e pode gerar custos. **Os testes e o verificador de base não fazem essa chamada.** Para experimentar apenas o código de decisão sem credenciais, comece por [test/](test/) e [base-legal/](base-legal/).

## A ideia técnica

1. **Pergunta:** recebe a questão e consulta a base documental versionada em `base-legal/`.
2. **Sustentação:** checa o suporte documental e a presença das citações antes de apresentar uma resposta.
3. **Fronteira:** quando falta fundamento, informa a limitação em vez de fingir certeza.

O prompt está em [`prompts/sistema.md`](prompts/sistema.md). O fluxo executável está em [`src/`](src/). O conjunto de perguntas de avaliação está em [`avaliacao/perguntas.json`](avaliacao/perguntas.json).

## O que não prometemos

- Legislação atualizada automaticamente, parecer profissional ou correção em todos os casos.
- Desempenho validado em produção ou consultas sem custo: perguntas reais dependem do provedor configurado.
- Que uma citação isolada prova a aplicabilidade da regra a um caso individual.

**Para quem implementa:** as duas skills de manutenção ficam em [`.claude/skills/`](.claude/skills/). Há ainda uma [skill portátil](skill/SKILL.md), cujo ZIP pode ser gerado com `npm run empacotar-skill`; o conteúdo legal exportado requer revisão antes da redistribuição.

**Continue por:** [detalhes técnicos](docs/DETALHES-TECNICOS.md) · [estado de validação](STATUS.md) · [como contribuir](CONTRIBUTING.md) · [versões](CHANGELOG.md) · [licença](LICENCIAMENTO.md).

Projeto da [Fincraft](https://github.com/fincraft-solutions) no ecossistema Wavern. Exemplos não devem conter dados reais.
