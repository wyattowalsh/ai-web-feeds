# `.github` Directory - Agent Instructions

> **Component**: GitHub Configuration, Workflows, Prompts, and Agents **Location**:
> `.github/` **Parent**: [Root AGENTS.md](../AGENTS.md)

## Essential Links

- [Root AGENTS.md](../AGENTS.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [Workflow README](workflows/README.md)
- [Full Docs](https://aiwebfeeds.com/llms-full.txt)

## Purpose

This directory contains repository-shared GitHub automation assets:

- issue and pull-request templates
- active GitHub Actions workflows in `.github/workflows/*.yml`
- repository-owned prompt assets in `.github/prompts/`
- reusable custom agents in `.github/agents/`
- Copilot and GitHub-specific instruction files

## Canonical Source Rules

### Prompts

`.github/prompts/` is the canonical repository-owned prompt library. If another tool
needs a copy or wrapper, derive it from these prompt files rather than editing multiple
prompt variants independently.

### Workflow Types

- `.github/workflows/*.yml` are the currently active GitHub Actions workflows.
- `.github/workflows/*.md` are reserved for GitHub Agentic Workflows sources.
- A workflow source `.md` file is not active until it is compiled into a lock workflow
  and reviewed.
- Existing deterministic YAML workflows remain canonical until an agentic replacement is
  explicitly adopted.

### Agents

Reusable repository agents belong in `.github/agents/`. Keep them narrowly scoped,
frontmatter-valid, and documented in `.github/agents/README.md`.

## Development Rules

### Do

- Reuse repository policies from [../AGENTS.md](../AGENTS.md) instead of copying them
  into many files.
- Keep automation additive and reviewable, especially when introducing agentic
  workflows.
- Prefer read-only analysis in agent jobs and narrow write surfaces through safe outputs
  or explicit review steps.
- Keep label names aligned with `.github/labels.yml`.
- Add manual or otherwise controlled triggers for new workflow pilots.

### Don’t

- Don’t introduce direct mutation from untrusted issue or PR text if a safer staged
  alternative exists.
- Don’t duplicate parsing or validation logic across multiple workflows without a good
  reason.
- Don’t commit secrets, tokens, or environment-specific values.
- Don’t replace deterministic CI checks with agent reasoning when the scripted check is
  already authoritative.

## gh-aw Conventions

When adding GitHub Agentic Workflows assets here:

- Use repository prompts and agents as shared building blocks.
- Prefer experimental, low-risk pilots before replacing live automation.
- Use sanitized issue or PR context rather than raw event bodies in prompts.
- Keep agentic workflows read-only unless the mutation path is intentionally configured
  through safe outputs.
- Document the relationship between a `.md` workflow source and any legacy `.yml`
  workflow it may eventually replace.

## Current Direction

The repository currently relies on conventional GitHub Actions. Agentic workflow
adoption is starting incrementally with additive pilots in `.github/workflows/*.md` and
reusable agents in `.github/agents/`.

Updated: 2026-03-23 · Version: 0.2.0
