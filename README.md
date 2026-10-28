**Language:** **English** | [Português (Brasil)](README.pt-BR.md)

# Dona Norma

```text
   ___
  | __|   FINCRAFT / DONA-NORMA
  | _|
  |_|
```

**Tax questions deserve answers you can trace back to their sources.**

Dona Norma is a source-aware assistant for everyday questions about Brazil's MEI and Simples Nacional regimes. It works with a local legal reference library, attaches citations to its answers, and makes the source material easy to inspect.

## Try it

Requires Node.js 22.20 or newer. Clone the repository and run:

```bash
npm ci
npm run verificar-base

# Optional: connect a model to ask a question
cp .env.example .env
npm run perguntar -- "Can an MEI hire an employee?"
```

The base checker runs locally. Asking a question requires a provider key in `.env` and may incur API costs. Brazilian rules change, so the reference documents need routine review.

## What's inside

- **Source-backed answers.** The assistant draws from the versioned `base-legal/` library.
- **Visible references.** Readers can follow citations back to the underlying text.
- **A clear handoff.** Questions beyond the material can be routed for professional review.

## Explore the code

[Legal reference library](base-legal/) · [Prompt](prompts/sistema.md) · [Source](src/) · [Technical guide](docs/en/guide.md)

## Extend it

The repository includes an optional portable agent skill in [`skill/SKILL.md`](skill/SKILL.md). The command `npm run empacotar-skill` builds an exportable bundle.

## Project notes

This is a developer preview for exploring source-based assistance. Specific tax decisions should be checked against current official guidance.

[Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) · [Fincraft](https://github.com/fincraft-solutions)
