# ai-web-feeds Copilot Instructions

Read [../AGENTS.md](../AGENTS.md) first, then the nearest component-specific `AGENTS.md`
before making changes.

## Non-Negotiable Tooling

- Python commands use `uv` only.
- Node.js commands use `pnpm` only.
- Do not introduce bare `python`, `pip`, `npm`, or `yarn` into code, docs, or workflow
  examples.

## Documentation Policy

Project documentation belongs in `apps/web/content/docs/` as `.mdx` files unless the
file is an explicitly allowed root exception such as `README.md`, `CONTRIBUTING.md`,
`LICENSE`, or `AGENTS.md`.

Development specifications under `specs/**/*.md` are also allowed. Treat them as
repository planning artifacts, not user-facing documentation.

## GitHub Automation Policy

- `.github/workflows/*.yml` are active workflows.
- `.github/workflows/*.md` are reserved for GitHub Agentic Workflows sources and are not
  active until compiled and reviewed.
- Prefer additive pilots over immediate workflow replacement.
- Keep agentic workflows read-only by default and use narrow, reviewable mutation paths.

## Prompt and Agent Sources

- `.github/prompts/` is the canonical repository prompt library.
- `.github/agents/` contains reusable repository-owned agents.
- Avoid copying prompt logic into multiple tool-specific locations unless the duplicate
  is generated from the canonical source.

## Current Focus

The repository is beginning selective gh-aw adoption. The first pilot is a
feed-submission review workflow that is intentionally additive and non-destructive.
