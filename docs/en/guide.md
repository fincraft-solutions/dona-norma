**Language:** **English** | [Português (Brasil)](../pt-BR/guide.md)

# Working with Dona Norma

[Back to Dona Norma](../../README.md)

## Starting point

Dona Norma is a source-aware assistant for everyday questions about Brazil's MEI and Simples Nacional regimes. It works with a local legal reference library, attaches citations to its answers, and makes the source material easy to inspect.

The first example in the README is the easiest route through the project:

```bash
npm ci
npm run verificar-base

# Optional: connect a model to ask a question
cp .env.example .env
npm run perguntar -- "Can an MEI hire an employee?"
```

## Components

- `base-legal/`: versioned reference material supporting answers.
- `src/base.ts` and `src/dona-norma.ts`: loading references and orchestrating questions.
- `prompts/sistema.md`: behavior guidance, written in Brazilian Portuguese for the intended domain.
- `test/`: edge cases and regression checks.
- `.claude/skills/`: helpers for maintenance and setup.

## Integration notes

Configure a provider through `.env.example` before using the question command. The document library needs an owner who reviews validity and effective dates. The bundled skill in `skill/SKILL.md` can be packaged with `npm run empacotar-skill`.

## Development

```bash
npm ci
npm run typecheck
npm test
```

The repository is built around Node.js 22.20 or newer.
