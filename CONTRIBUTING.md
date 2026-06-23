# Contributing to ai-web-feeds

Thank you for contributing. This file is a pointer to the canonical contributor
documentation on the docs site.

## Canonical docs

- [Contributing overview](https://aiwebfeeds.vercel.app/docs/development/contributing)
- [Development workflow](https://aiwebfeeds.vercel.app/docs/contributing/development-workflow)
- [Conventional commits](https://aiwebfeeds.vercel.app/docs/contributing/conventional-commits)
- [Pre-commit hooks](https://aiwebfeeds.vercel.app/docs/contributing/pre-commit-hooks)

## Quick start

```bash
git clone https://github.com/wyattowalsh/ai-web-feeds.git
cd ai-web-feeds

uv sync

cd apps/web && pnpm install && cd ../..

uv run pre-commit install
uv run pre-commit install --hook-type commit-msg
cd tests && uv run pytest
uv run ai-web-feeds --help
```

## Toolchain (required)

- **Python:** `uv run python` / `uv run <command>` only (never bare `python` or `pip`)
- **Node.js (apps/web):** `pnpm` only (never `npm` or `yarn`)

See [AGENTS.md](AGENTS.md) for agent and component-specific instructions.