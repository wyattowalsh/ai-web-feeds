# AIWebFeeds - Root Agent Instructions

> **Navigation Hub**: Start here, then follow component-specific `AGENTS.md` links below.

## 📍 Quick Navigation

| Component | Path | Reference Docs |
|-----------|------|----------------|
| **Core Package** | [`packages/ai_web_feeds/`](packages/ai_web_feeds/) | [`AGENTS.md`](packages/ai_web_feeds/AGENTS.md) · [Full Docs](https://aiwebfeeds.com/llms-full.txt#core-package) |
| **CLI** | [`apps/cli/`](apps/cli/) | [`AGENTS.md`](apps/cli/AGENTS.md) · [CLI Docs](https://aiwebfeeds.com/docs/cli) |
| **Web** | [`apps/web/`](apps/web/) | [`AGENTS.md`](apps/web/AGENTS.md) · [#file:web](file:///Users/ww/dev/projects/ai-web-feeds/apps/web) |
| **Tests** | [`tests/`](tests/) | [`AGENTS.md`](tests/AGENTS.md) · [Testing Guide](https://aiwebfeeds.com/docs/contributing/testing) |

## 🔗 Essential Resources

- **Comprehensive Docs**: [aiwebfeeds.com/llms-full.txt](https://aiwebfeeds.com/llms-full.txt)
- **Contributing Guide**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **Repository**: [github.com/wyattowalsh/ai-web-feeds](https://github.com/wyattowalsh/ai-web-feeds)

---

## 🏗️ Architecture Overview

**Hybrid Monorepo**: Python (uv) + TypeScript (pnpm)

```
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
│   └── aiwebfeeds.db         # SQLite cache
└── .github/                   # GitHub templates & workflows
```

**Stack**: Python 3.13+, Next.js 15, React 19, SQLAlchemy, Pydantic v2, Tailwind 4

---

## 📐 Core Principles

### 1. Documentation-First Development ⚠️ CRITICAL

**🚫 ABSOLUTE PROHIBITION: NO STANDALONE `.md` FILES FOR DOCUMENTATION**

- ✅ **ALL documentation MUST be `.mdx` files in [`apps/web/content/docs/`](apps/web/content/docs/)**
- ❌ **NEVER EVER create `.md` files** like `DATABASE.md`, `GUIDE.md`, `QUICKSTART.md`, `ARCHITECTURE.md`, `TUTORIAL.md`, `HOW_TO.md`, `SUMMARY.md`, etc.
- ❌ **FORBIDDEN LOCATIONS**: Any `.md` file in `packages/`, `apps/cli/`, `data/`, workspace root (except `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE`, `AGENTS.md`)
- ✅ **REQUIRED WORKFLOW**:
  1. Create `.mdx` file in `apps/web/content/docs/` (e.g., `apps/web/content/docs/development/database.mdx`)
  2. Add frontmatter: `title` and `description`
  3. Update `apps/web/content/docs/meta.json` to add to navigation
  4. NEVER create standalone `.md` files as "temporary" or "supplementary" docs
- ✅ **LLM-optimized formats** → Auto-generated at `/llms-full.txt` and `/llms.txt` from web docs

**Examples of FORBIDDEN files:**
```
❌ packages/ai_web_feeds/DATABASE.md
❌ packages/ai_web_feeds/SIMPLIFIED_ARCHITECTURE.md
❌ apps/cli/USER_GUIDE.md
❌ SIMPLIFICATION_SUMMARY.md
❌ NEW_FEATURE_DOCS.md
❌ Any other .md file except allowed root files
```

**See [Web AGENTS.md](apps/web/AGENTS.md) for detailed documentation structure**

### 2. Component Isolation
- Each component has **dedicated `AGENTS.md`** with specific patterns
- **Cross-component changes** → Update multiple `AGENTS.md` files
- **Read before editing** → Root + component-specific docs required

### 3. Quality Standards
- **Type Safety**: Python (mypy), TypeScript (strict mode), Data (JSON Schema)
- **Testing**: ≥90% coverage, property-based tests (see [Tests AGENTS.md](tests/AGENTS.md))
- **Code Quality**: Ruff (Python), ESLint 9 (TypeScript), conventional commits

---

## ⚡ Quick Start

```bash
# Python environment
uv sync && uv run aiwebfeeds --help

# Web development
cd apps/web && pnpm install && pnpm dev

# Run tests
cd tests && uv run pytest --cov
```

---

## 🔄 Standard Workflow

1. **Read relevant docs**: Root → Component `AGENTS.md` → [llms-full.txt](https://aiwebfeeds.com/llms-full.txt)
2. **Create feature branch**: `git checkout -b feat/component-description`
3. **Write tests first** (TDD preferred, see [Tests AGENTS.md](tests/AGENTS.md))
4. **Implement + lint**: `uv run ruff check --fix .` or `pnpm lint --fix`
5. **Update documentation**: Edit [`apps/web/content/docs/`](apps/web/content/docs/)
6. **Verify coverage**: `uv run aiwebfeeds test coverage` (≥90% required)
7. **Commit**: `git commit -m "feat(scope): description"` (conventional commits)

**Recent Updates (October 2025)**:
- ✅ Test suite fully synchronized with 100% module coverage (11 test files)
- ✅ New tests: `test_load.py`, `test_validate.py`, `test_export.py`, `test_enrich.py`, `test_logger.py`
- ✅ 1,600+ lines of comprehensive test code with property-based testing
- ✅ All tests use `uv run` for consistent execution

---

## 🤖 AI Agent Critical Rules

**⚠️ DOCUMENTATION RULE - READ THIS FIRST:**

**🚫 NEVER CREATE `.md` FILES FOR DOCUMENTATION - EVER!**

If you need to document anything:
1. Create `.mdx` file in `apps/web/content/docs/`
2. Add frontmatter (`title`, `description`)
3. Update `apps/web/content/docs/meta.json`
4. That's it - NO EXCEPTIONS!

**Before any code change:**

1. ✅ **Read component `AGENTS.md`** → Navigate via table above
2. ✅ **Check [llms-full.txt](https://aiwebfeeds.com/llms-full.txt)** for comprehensive context
3. ✅ **Update web docs ONLY** → ALL documentation goes to `apps/web/content/docs/*.mdx`
4. ❌ **NEVER create `.md` files** → No `DATABASE.md`, `GUIDE.md`, `QUICKSTART.md`, `ARCHITECTURE.md`, `SUMMARY.md`, etc.
5. ✅ **Maintain ≥90% coverage** → See [Tests AGENTS.md](tests/AGENTS.md)
6. ✅ **Use type hints** → Python + TypeScript strict mode
7. ✅ **Run linters** → Ruff/ESLint before suggesting changes
8. ✅ **Conventional commits** → `feat|fix|docs|test|refactor(scope): msg`

**ABSOLUTE DOCUMENTATION RULES:**

- ❌ **FORBIDDEN FILES**: `*.md` in `packages/`, `apps/cli/`, `data/`, workspace root (except `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE`, `AGENTS.md`, `WARP.md`)
- ✅ **ONLY ALLOWED**: `.mdx` files in `apps/web/content/docs/` with proper frontmatter
- ✅ **REQUIRED**: Update `apps/web/content/docs/meta.json` for every new doc page
- ❌ **NO "TEMPORARY" OR "SUPPLEMENTARY" `.md` FILES** - They become permanent clutter

**Troubleshooting**: See component-specific `AGENTS.md` files for detailed guidance.

---

## 📊 Data Files Reference

### Core Data Files

| File | Purpose | Schema |
|------|---------|--------|
| `data/feeds.yaml` | Feed definitions (URLs, metadata) | `feeds.schema.json` |
| `data/feeds.enriched.yaml` | AI-enriched feed metadata | `feeds.enriched.schema.json` |
| `data/topics.yaml` | Topic taxonomy (graph structure, facets, relations) | `topics.schema.json` |
| `data/*.opml` | Feed reader import files | OPML 2.0 |
| `data/aiwebfeeds.db` | SQLite cache (validation, health) | SQLAlchemy models |

**Key**: Always validate data files against their JSON schemas before committing.

---

**Version**: 0.1.0 (Beta) · **License**: Apache 2.0 · **Updated**: October 15, 2025

## Active Technologies
- Python 3.13+ (backend, CLI) + TypeScript 5.9+ (web) (001-core-project-spec)
- SQLite (development), PostgreSQL (production option) for validation cache, enrichment data, and feed entry metadata (001-core-project-spec)

## Recent Changes
- 001-core-project-spec: Added Python 3.13+ (backend, CLI) + TypeScript 5.9+ (web)
