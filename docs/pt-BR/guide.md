**Idioma:** [English](../en/guide.md) | **Português (Brasil)**

# Trabalhando com Dona Norma

[Voltar para Dona Norma](../../README.pt-BR.md)

## Para começar

A Dona Norma é uma assistente para dúvidas frequentes sobre MEI e Simples Nacional. Ela consulta uma base legal local, apresenta as fontes utilizadas e permite acompanhar a origem de cada resposta.

O exemplo mais simples está no README:

```bash
npm ci
npm run verificar-base

# Opcional: configure um modelo para conversar
cp .env.example .env
npm run perguntar -- "MEI pode contratar um empregado?"
```

## Componentes

- `base-legal/`: documentos de referência versionados.
- `src/base.ts` e `src/dona-norma.ts`: consulta à base e orquestração das perguntas.
- `prompts/sistema.md`: orientações de comportamento no domínio fiscal.
- `test/`: casos de borda e regressões.
- `.claude/skills/`: auxiliares para manutenção e configuração.

## Integração

Configure o provedor de IA seguindo `.env.example` antes de perguntar. A base legal precisa ser revisada quanto à vigência. O arquivo `skill/SKILL.md` pode ser empacotado com `npm run empacotar-skill`.

## Desenvolvimento

```bash
npm ci
npm run typecheck
npm test
```

O projeto utiliza Node.js 22.20 ou superior.
