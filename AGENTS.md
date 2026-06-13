# ai-web-feeds - Root Agent Instructions

> **Navigation Hub**: Start here, then follow component-specific `AGENTS.md` links
> below.

## ⚠️ CRITICAL: Package Manager Enforcement

**ALWAYS use the correct package managers - this is non-negotiable:**

- **Python:** ONLY `uv run python` or `uv run <command>` (NEVER bare `python`, `pip`,
  `pip install`, `python -m pip`, `poetry`)
- **Node.js:** ONLY `pnpm` (NEVER `npm`, `npm install`, `yarn`)

**Examples:**

✅ **CORRECT:**

```bash
uv sync                           # Install Python dependencies
uv add package                    # Add Python package
uv run python script.py           # Run Python scripts
uv run python -m module           # Run Python modules
uv run pytest                     # Run Python commands/tools
uv run ai-web-feeds               # Run CLI commands
pnpm install                      # Install Node dependencies
pnpm add package                  # Add Node package
pnpm run dev                      # Run Node scripts
```

❌ **FORBIDDEN:**

```bash
python script.py                  # NEVER use bare python
python -m pytest                  # NEVER use python -m directly
pip install package               # NEVER use pip
python -m pip install             # NEVER use pip via python -m
poetry add package                # NEVER use poetry
npm install                       # NEVER use npm
yarn add package                  # NEVER use yarn
```

**Rationale:**

- `uv run python` ensures consistent environment isolation and correct virtualenv
  activation
- `uv` is 10-100x faster than pip and correctly handles workspace dependencies
- `pnpm` uses efficient disk space with symlinks and has better monorepo support

## 📍 Quick Navigation

| Component        | Path                                               | Reference Docs                                                                                                         |
| ---------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Core Package** | [`packages/ai_web_feeds/`](packages/ai_web_feeds/) | [`AGENTS.md`](packages/ai_web_feeds/AGENTS.md) · [Full Docs](https://aiwebfeeds.vercel.app/llms-full.txt#core-package) |
| **CLI**          | [`apps/cli/`](apps/cli/)                           | [`AGENTS.md`](apps/cli/AGENTS.md) · [CLI Docs](https://aiwebfeeds.vercel.app/docs/development/cli)                     |
| **Web**          | [`apps/web/`](apps/web/)                           | [`AGENTS.md`](apps/web/AGENTS.md) · \[#file:web\](file:///Users/ww/dev/projects/ai-web-feeds/apps/web)                 |
| **Tests**        | [`tests/`](tests/)                                 | [`AGENTS.md`](tests/AGENTS.md) · [Testing Guide](https://aiwebfeeds.vercel.app/docs/guides/testing)                    |

## 🔗 Essential Resources

- **Comprehensive Docs**:
  [aiwebfeeds.vercel.app/llms-full.txt](https://aiwebfeeds.vercel.app/llms-full.txt)
- **Contributing Guide**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **Repository**:
  [github.com/wyattowalsh/ai-web-feeds](https://github.com/wyattowalsh/ai-web-feeds)

______________________________________________________________________

## 🏗️ Architecture Overview

**Hybrid Monorepo**: Python (uv) + TypeScript (pnpm)

```text
ai-web-feeds/
├── packages/ai_web_feeds/    # Core: Fetching, storage, analytics
├── apps/cli/                  # Typer CLI interface
├── apps/web/                  # Next.js documentation site
├── tests/                     # Pytest test suite (≥90% coverage)
├── data/                      # Feeds data (YAML/JSON/OPML/SQLite)
│   ├── feeds.yaml            # Feed definitions
│   ├── feeds.enriched.yaml   # AI-enriched feed metadata
│   ├── topics.yaml           # Topic taxonomy (graph structure)
│   ├── *.schema.json         # JSON Schema validation
│   ├── *.opml                # Feed reader imports
│   └── ai-web-feeds.db       # SQLite cache
└── .github/                   # GitHub templates & workflows
```

**Stack**: Python 3.13+, Next.js 15, React 19, SQLAlchemy, Pydantic v2, Tailwind 4

______________________________________________________________________

## 📐 Core Principles

### 1. Documentation-First Development ⚠️ CRITICAL

**🚫 ABSOLUTE PROHIBITION: NO STANDALONE `.md` FILES FOR DOCUMENTATION**

- ✅ **ALL documentation MUST be `.mdx` files in
  [`apps/web/content/docs/`](apps/web/content/docs/)**
- ❌ **NEVER EVER create `.md` files** like `DATABASE.md`, `GUIDE.md`, `QUICKSTART.md`,
  `ARCHITECTURE.md`, `TUTORIAL.md`, `HOW_TO.md`, `SUMMARY.md`, etc.
- ❌ **FORBIDDEN LOCATIONS**: Any `.md` file in `packages/`, `apps/cli/`, `data/`,
  workspace root (except `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `LICENSE`, `AGENTS.md`)
- ✅ **DEVELOPMENT ARTIFACT EXCEPTION**: `specs/**/*.md` are allowed for technical
  specifications, planning, and checklists. They are repository development artifacts,
  not user-facing project documentation.
- ✅ **REQUIRED WORKFLOW**:
  1. Create `.mdx` file in `apps/web/content/docs/` (e.g.,
     `apps/web/content/docs/development/database.mdx`)
  1. Add frontmatter: `title` and `description`
  1. Update `apps/web/content/docs/meta.json` to add to navigation
  1. NEVER create standalone `.md` files as "temporary" or "supplementary" docs
- ✅ **LLM-optimized formats** → Auto-generated at `/llms-full.txt` and `/llms.txt` from
  web docs

**Examples of FORBIDDEN files:**

```text
❌ packages/ai_web_feeds/DATABASE.md
❌ packages/ai_web_feeds/SIMPLIFIED_ARCHITECTURE.md
❌ apps/cli/USER_GUIDE.md
❌ SIMPLIFICATION_SUMMARY.md
❌ NEW_FEATURE_DOCS.md
❌ Any other .md file except allowed root files
```

**Allowed development artifact examples:**

```text
✅ specs/001-core-project-spec/spec.md
✅ specs/001-core-project-spec/plan.md
✅ specs/002-data-discovery-analytics/checklists/test-coverage.md
```

**See [Web AGENTS.md](apps/web/AGENTS.md) for detailed documentation structure**

### 2. Component Isolation

- Each component has **dedicated `AGENTS.md`** with specific patterns
- **Cross-component changes** → Update multiple `AGENTS.md` files
- **Read before editing** → Root + component-specific docs required

### 3. Quality Standards

- **Type Safety**: Python (mypy), TypeScript (strict mode), Data (JSON Schema)
- **Testing**: ≥90% coverage, property-based tests (see
  [Tests AGENTS.md](tests/AGENTS.md))
- **Code Quality**: Ruff (Python), ESLint 9 (TypeScript), conventional commits

______________________________________________________________________

## ⚡ Quick Start

```bash
# Python environment (ALWAYS use uv run python)
uv sync && uv run ai-web-feeds --help

# Web development (ALWAYS use pnpm)
cd apps/web && pnpm install && pnpm dev

# Run tests
cd tests && uv run pytest --cov
```

**⚠️ CRITICAL: Package Manager Requirements:**

- **Python:** ALWAYS use `uv run python` or `uv run <command>` (NEVER bare `python`,
  `pip`, `pip install`, `python -m pip`)
- **Node.js:** ALWAYS use `pnpm` (NEVER `npm` or `yarn`)
- **Rationale:** `uv run python` ensures consistent environment isolation and correct
  virtualenv activation; uv is faster and handles workspace dependencies correctly; pnpm
  uses efficient disk space with symlinks

______________________________________________________________________

## 🔄 Standard Workflow

1. **Read relevant docs**: Root → Component `AGENTS.md` →
   [llms-full.txt](https://aiwebfeeds.vercel.app/llms-full.txt)
1. **Create feature branch**: `git checkout -b feat/component-description`
1. **Write tests first** (TDD preferred, see [Tests AGENTS.md](tests/AGENTS.md))
1. **Implement + lint**: `uv run ruff check --fix .` or `pnpm lint --fix`
1. **Update documentation**: Edit [`apps/web/content/docs/`](apps/web/content/docs/)
1. **Verify coverage**: `uv run ai-web-feeds test coverage` (≥90% required)
1. **Commit**: `git commit -m "feat(scope): description"` (conventional commits)

**Recent Updates (October 2025)**:

- ✅ Test suite fully synchronized with 100% module coverage (11 test files)
- ✅ New tests: `test_load.py`, `test_validate.py`, `test_export.py`, `test_enrich.py`,
  `test_logger.py`
- ✅ 1,600+ lines of comprehensive test code with property-based testing
- ✅ All tests use `uv run` for consistent execution

______________________________________________________________________

## 🤖 AI Agent Critical Rules

**⚠️ DOCUMENTATION RULE - READ THIS FIRST:**

**🚫 NEVER CREATE `.md` FILES FOR DOCUMENTATION - EVER!**

If you need to document anything:

1. Create `.mdx` file in `apps/web/content/docs/`
1. Add frontmatter (`title`, `description`)
1. Update `apps/web/content/docs/meta.json`
1. That's it - NO EXCEPTIONS!

**Before any code change:**

1. ✅ **Read component `AGENTS.md`** → Navigate via table above
1. ✅ **Check [llms-full.txt](https://aiwebfeeds.vercel.app/llms-full.txt)** for
   comprehensive context
1. ✅ **Update web docs ONLY** → ALL documentation goes to `apps/web/content/docs/*.mdx`
1. ❌ **NEVER create `.md` files** → No `DATABASE.md`, `GUIDE.md`, `QUICKSTART.md`,
   `ARCHITECTURE.md`, `SUMMARY.md`, etc.
1. ✅ **Maintain ≥90% coverage** → See [Tests AGENTS.md](tests/AGENTS.md)
1. ✅ **Use type hints** → Python + TypeScript strict mode
1. ✅ **Run linters** → Ruff/ESLint before suggesting changes
1. ✅ **Conventional commits** → `feat|fix|docs|test|refactor(scope): msg`
1. ✅ **ALWAYS use `uv run python` for Python** → NEVER bare `python`, `pip`,
   `pip install`, `python -m pip`
1. ✅ **ALWAYS use `pnpm` for Node.js** → NEVER `npm install` or `yarn`

**ABSOLUTE DOCUMENTATION RULES:**

- ❌ **FORBIDDEN FILES**: `*.md` in `packages/`, `apps/cli/`, `data/`, workspace root
  (except `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE`, `AGENTS.md`,
  `WARP.md`)
- ✅ **EXCEPTION**: `specs/**/*.md` are allowed as development-only specification and
  planning artifacts
- ✅ **ONLY ALLOWED**: `.mdx` files in `apps/web/content/docs/` with proper frontmatter
- ✅ **REQUIRED**: Update `apps/web/content/docs/meta.json` for every new doc page
- ❌ **NO "TEMPORARY" OR "SUPPLEMENTARY" `.md` FILES** - They become permanent clutter

**Troubleshooting**: See component-specific `AGENTS.md` files for detailed guidance.

______________________________________________________________________

## 📊 Data Files Reference

### Core Data Files

| File                       | Purpose                                             | Schema                       |
| -------------------------- | --------------------------------------------------- | ---------------------------- |
| `data/feeds.yaml`          | Feed definitions (URLs, metadata)                   | `feeds.schema.json`          |
| `data/feeds.enriched.yaml` | AI-enriched feed metadata                           | `feeds.enriched.schema.json` |
| `data/topics.yaml`         | Topic taxonomy (graph structure, facets, relations) | `topics.schema.json`         |
| `data/*.opml`              | Feed reader import files                            | OPML 2.0                     |
| `data/ai-web-feeds.db`     | SQLite cache (validation, health)                   | SQLAlchemy models            |

**Key**: Always validate data files against their JSON schemas before committing.

______________________________________________________________________

**Version**: 0.1.0 (Beta) · **License**: Apache 2.0 · **Updated**: October 15, 2025

## Active Technologies

- Python 3.13+ (backend, CLI) + TypeScript 5.9+ (web) (001-core-project-spec)
- SQLite (development), PostgreSQL (production option) for validation cache, enrichment
  data, and feed entry metadata (001-core-project-spec)
- TypeScript 5.9 (strict) with React 19 on Next.js 15 App Router + Next.js 15, React 19,
  FumaDocs UI, Chart.js, Dexie.js 4, `onnxruntime-web`, Service Worker/Web Worker APIs
  (004-client-side-features)
- IndexedDB (articles, search index, annotations), Cache Storage (assets), localStorage
  (preferences, folders) (004-client-side-features)

## Recent Changes

- 001-core-project-spec: Added Python 3.13+ (backend, CLI) + TypeScript 5.9+ (web)
