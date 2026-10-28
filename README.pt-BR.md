**Idioma:** [English](README.md) | **Português (Brasil)**

# Dona Norma

```text
   ___
  | __|   FINCRAFT / DONA-NORMA
  | _|
  |_|
```

**A Dona Norma é uma assistente para dúvidas frequentes sobre MEI e Simples Nacional. Ela consulta uma base legal local, apresenta as fontes utilizadas e permite acompanhar a origem de cada resposta.**

## Primeiros passos

Requer Node.js 22.20 ou superior. Clone o repositório e rode o exemplo:

```bash
npm ci
npm run verificar-base

# Opcional: configure um modelo para conversar
cp .env.example .env
npm run perguntar -- "MEI pode contratar um empregado?"
```

A conferência da base funciona localmente. Para fazer perguntas, configure o provedor no `.env`. A consulta pode gerar custos de API. A base documental precisa acompanhar mudanças na legislação.

## O que você encontra

- **Base documental.** O conteúdo versionado fica em `base-legal/`.
- **Fontes acessíveis.** As referências ajudam a conferir o fundamento de cada resposta.
- **Encaminhamento.** Casos que exigem análise específica podem seguir para revisão profissional.

## Para explorar

[Base legal](base-legal/) · [Prompt](prompts/sistema.md) · [Código](src/) · [Guia técnico](docs/pt-BR/guide.md)

## Integração

O repositório inclui uma skill portátil em [`skill/SKILL.md`](skill/SKILL.md). O comando `npm run empacotar-skill` prepara o pacote para exportação.

## Sobre o projeto

Esta é uma prévia para explorar assistência baseada em fontes. Decisões tributárias específicas devem ser verificadas à luz da orientação oficial vigente.

[Como contribuir](CONTRIBUTING.pt-BR.md) · [Notas de versão](CHANGELOG.pt-BR.md) · [Fincraft](https://github.com/fincraft-solutions)
