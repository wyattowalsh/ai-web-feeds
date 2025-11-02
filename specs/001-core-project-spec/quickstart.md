# Quickstart Guide: AIWebFeeds Development

**Feature**: AIWebFeeds - AI/ML Feed Aggregator Platform\
**Branch**: `001-core-project-spec`\
**Date**: 2025-10-22\
**Status**: Complete

## Overview

This guide provides step-by-step instructions for setting up the AIWebFeeds development
environment, running tests, and contributing to the project. The project uses a hybrid
monorepo structure with Python (managed by `uv`) and TypeScript (managed by `pnpm`).

______________________________________________________________________

## Prerequisites

### Required Software

| Tool        | Version | Purpose                    | Install                                                                |
| ----------- | ------- | -------------------------- | ---------------------------------------------------------------------- |
| **Python**  | 3.13+   | Core package & CLI         | [python.org](https://www.python.org/downloads/)                        |
| **uv**      | latest  | Python package manager     | `pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| **Node.js** | 20+     | Web application            | [nodejs.org](https://nodejs.org/) or `nvm install 20`                  |
| **pnpm**    | 8+      | TypeScript package manager | `npm install -g pnpm`                                                  |
| **Git**     | 2.30+   | Version control            | [git-scm.com](https://git-scm.com/)                                    |

### Optional Tools

- **SQLite** (bundled with Python): Development database
- **PostgreSQL** 15+: Production database (optional for local dev)
- **VS Code**: Recommended IDE with Python & TypeScript extensions
- **pre-commit**: Git hooks for linting/formatting

______________________________________________________________________

## Initial Setup

### 1. Clone Repository

```bash
# Clone the repository
git clone https://github.com/wyattowalsh/ai-web-feeds.git
cd ai-web-feeds

# Create feature branch (if working on new feature)
git checkout -b feat/your-feature-name
```

### 2. Python Environment Setup

```bash
# Install uv (if not already installed)
pip install uv

# Verify uv installation
uv --version

# Sync Python workspace (creates .venv and installs all dependencies)
uv sync

# This installs:
# - packages/ai_web_feeds (core package)
# - apps/cli (CLI application)
# - tests (test dependencies)
# - Dev dependencies (ruff, mypy, pytest, etc.)
# - Core dependencies (pydantic, pydantic-settings, sqlmodel, httpx, tqdm, etc.)
```

**What `uv sync` does**:

- Creates a virtual environment in `.venv/`
- Installs all workspace members (packages, apps)
- Resolves and locks dependencies in `uv.lock`
- Installs dev dependencies (linters, type checkers, test frameworks)

### 3. TypeScript Environment Setup

```bash
# Navigate to web application
cd apps/web

# Install dependencies with pnpm
pnpm install

# This installs:
# - Next.js 15
# - React 19
# - FumaDocs
# - Tailwind CSS 4
# - TypeScript dependencies

# Return to repo root
cd ../..
```

### 4. Verify Installation

```bash
# Test Python CLI
uv run aiwebfeeds --help

# Test type checking
uv run mypy packages/ai_web_feeds/

# Test linting
uv run ruff check .

# Test Python tests
uv run pytest

# Test TypeScript build (from apps/web/)
cd apps/web && pnpm build && cd ../..
```

### 5. Pre-commit Hooks (Recommended)

```bash
# Install pre-commit framework
uv pip install pre-commit

# Install git hooks
pre-commit install

# Run hooks manually on all files
pre-commit run --all-files
```

______________________________________________________________________

## Development Workflow

### Python Development (Core Package & CLI)

#### Project Structure

```
packages/ai_web_feeds/          # Core Python library
├── src/ai_web_feeds/
│   ├── __init__.py
│   ├── config.py               # Settings (Pydantic)
│   ├── models.py               # Database models (SQLModel)
│   ├── storage.py              # Database operations
│   ├── load.py                 # YAML loading
│   ├── validate.py             # Feed validation
│   ├── enrich.py               # Feed enrichment
│   ├── export.py               # OPML/JSON export
│   ├── logger.py               # Logging setup
│   └── utils.py                # Utilities
└── pyproject.toml              # Package config

apps/cli/                        # CLI application
├── ai_web_feeds/cli/
│   ├── __init__.py
│   ├── __main__.py
│   └── commands/
│       ├── load.py
│       ├── validate.py
│       ├── enrich.py
│       ├── export.py
│       └── stats.py
└── pyproject.toml              # CLI config

tests/                           # Test suite
├── conftest.py                 # Pytest fixtures
├── pytest.ini                  # Pytest config
└── tests/
    ├── packages/ai_web_feeds/
    │   ├── unit/               # Unit tests (mirror source structure)
    │   ├── integration/        # Integration tests
    │   └── e2e/                # End-to-end tests
    └── cli/
        ├── unit/
        └── integration/
```

#### Running the CLI

```bash
# All CLI commands use `uv run` prefix

# Show help
uv run aiwebfeeds --help

# Load feeds from YAML
uv run aiwebfeeds load data/feeds.yaml

# Validate all feeds
uv run aiwebfeeds validate all

# Validate specific feed
uv run aiwebfeeds validate --feed-id openai-blog

# Enrich feeds with metadata
uv run aiwebfeeds enrich all

# Export to OPML
uv run aiwebfeeds export opml --output data/feeds.opml

# Export to JSON
uv run aiwebfeeds export json --output data/feeds.json

# Show collection statistics
uv run aiwebfeeds stats
```

#### Adding New Features

**Test-First Development (TDD)**:

1. **Write test first** (in `tests/packages/ai_web_feeds/unit/`):

```python
# tests/packages/ai_web_feeds/unit/test_new_feature.py
import pytest
from ai_web_feeds.new_feature import new_function


@pytest.mark.unit
def test_new_function_success():
    """Test new function with valid input."""
    result = new_function("input")
    assert result == "expected_output"


@pytest.mark.unit
def test_new_function_invalid_input():
    """Test new function with invalid input."""
    with pytest.raises(ValueError):
        new_function("")
```

2. **Run test (should fail)**:

```bash
uv run pytest tests/packages/ai_web_feeds/unit/test_new_feature.py -v
```

3. **Implement feature** (in `packages/ai_web_feeds/src/ai_web_feeds/`):

```python
# packages/ai_web_feeds/src/ai_web_feeds/new_feature.py
def new_function(input: str) -> str:
    """
    Docstring explaining function purpose.

    Args:
        input: Description of input parameter

    Returns:
        Description of return value

    Raises:
        ValueError: If input is empty
    """
    if not input:
        raise ValueError("Input cannot be empty")

    return f"processed: {input}"
```

4. **Run test (should pass)**:

```bash
uv run pytest tests/packages/ai_web_feeds/unit/test_new_feature.py -v
```

5. **Check coverage**:

```bash
uv run pytest --cov=ai_web_feeds --cov-report=html
# Open htmlcov/index.html in browser
```

#### Linting & Type Checking

```bash
# Ruff linting (check only)
uv run ruff check .

# Ruff linting (fix issues automatically)
uv run ruff check --fix .

# Ruff formatting
uv run ruff format .

# Mypy type checking
uv run mypy packages/ai_web_feeds/

# Type check specific file
uv run mypy packages/ai_web_feeds/src/ai_web_feeds/validate.py
```

#### Running Tests

```bash
# Run all tests
uv run pytest

# Run with coverage
uv run pytest --cov=ai_web_feeds --cov-report=term-missing

# Run specific test file
uv run pytest tests/packages/ai_web_feeds/unit/test_validate.py

# Run specific test function
uv run pytest tests/packages/ai_web_feeds/unit/test_validate.py::test_validate_feed_success

# Run tests by marker
uv run pytest -m unit          # Only unit tests
uv run pytest -m integration   # Only integration tests
uv run pytest -m "not slow"    # Exclude slow tests

# Run tests in parallel
uv run pytest -n auto          # Uses pytest-xdist

# Verbose output
uv run pytest -v

# Stop on first failure
uv run pytest -x
```

#### Adding Dependencies

```bash
# Add package dependency (e.g., httpx)
cd packages/ai_web_feeds
uv add httpx

# Add dev dependency (e.g., black)
uv add --dev black

# Add CLI dependency
cd apps/cli
uv add typer

# Add test dependency (workspace root)
cd ../..
uv add --dev pytest-mock

# Update all dependencies
uv sync --upgrade
```

______________________________________________________________________

### TypeScript Development (Web Application)

#### Project Structure

```
apps/web/
├── app/                        # Next.js 15 App Router
│   ├── (home)/                 # Home page group
│   │   └── page.tsx
│   ├── docs/                   # Documentation routes
│   │   └── [[...slug]]/
│   │       └── page.tsx
│   ├── explorer/               # Interactive feed explorer
│   │   └── page.tsx
│   ├── api/                    # API routes
│   │   ├── feeds/
│   │   ├── topics/
│   │   └── search/
│   ├── llms-full.txt/          # LLM-optimized docs
│   │   └── route.ts
│   └── llms.txt/
│       └── route.ts
├── content/docs/               # MDX documentation (single source of truth)
│   ├── index.mdx
│   ├── getting-started/
│   ├── api/
│   ├── cli/
│   ├── contributing/
│   └── meta.json               # Navigation structure
├── components/                 # React components
│   ├── feed-card.tsx
│   ├── topic-graph.tsx
│   └── search-bar.tsx
├── lib/                        # Utilities & data access
│   ├── feeds.ts                # Load feeds.json
│   ├── topics.ts               # Load topics.json
│   └── search.ts               # Search implementation
├── public/                     # Static assets
├── styles/                     # Global styles
├── package.json                # pnpm package config
├── next.config.mjs             # Next.js configuration
├── tailwind.config.ts          # Tailwind configuration
└── tsconfig.json               # TypeScript configuration
```

#### Running Development Server

```bash
# From apps/web/ directory
cd apps/web

# Start development server
pnpm dev

# Server runs on http://localhost:3000
# - Hot reload enabled
# - Fast Refresh for React components
# - API routes available at /api/*
```

#### Building for Production

```bash
# From apps/web/ directory

# Pre-build: Generate data assets (Python)
cd ../..
uv run aiwebfeeds export all
cd apps/web

# Build Next.js application
pnpm build

# Start production server
pnpm start

# Preview production build locally
pnpm preview
```

#### Adding Documentation

**All documentation MUST be `.mdx` files in `apps/web/content/docs/`**:

1. **Create `.mdx` file** (e.g., `apps/web/content/docs/guides/new-feature.mdx`):

````mdx
---
title: New Feature Guide
description: Learn how to use the new feature
---

# New Feature Guide

This guide explains how to use the new feature.

## Overview

Description of the feature...

## Usage

```bash
uv run aiwebfeeds new-feature
````

## Examples

...

````

2. **Update navigation** (`apps/web/content/docs/meta.json`):
```json
{
  "pages": ["index", "getting-started"],
  "guides": {
    "title": "Guides",
    "pages": [
      "guides/quickstart",
      "guides/new-feature"
    ]
  }
}
````

3. **Verify in browser**:

```bash
pnpm dev
# Visit http://localhost:3000/docs/guides/new-feature
```

#### TypeScript Linting & Type Checking

```bash
# From apps/web/ directory

# ESLint check
pnpm lint

# ESLint fix
pnpm lint --fix

# TypeScript type check
pnpm tsc --noEmit

# Format with Prettier (if configured)
pnpm format
```

#### Adding npm Dependencies

```bash
# From apps/web/ directory

# Add production dependency
pnpm add <package>

# Add dev dependency
pnpm add -D <package>

# Update dependencies
pnpm update

# Remove dependency
pnpm remove <package>

# Install after checkout
pnpm install
```

______________________________________________________________________

## Data Management

### Data File Locations

```
data/
├── feeds.yaml                  # Source of truth: Feed definitions
├── feeds.schema.json           # JSON Schema for validation
├── feeds.enriched.yaml         # AI-enriched feed metadata
├── feeds.enriched.schema.json
├── topics.yaml                 # Source of truth: Topic taxonomy
├── topics.schema.json
├── feeds.json                  # Generated: JSON export for Next.js
├── topics.json                 # Generated: JSON export for Next.js
├── stats.json                  # Generated: Collection statistics
├── *.opml                      # Generated: OPML exports
└── aiwebfeeds.db               # SQLite database (development)
```

### Editing Data Files

**Feeds** (`data/feeds.yaml`):

```yaml
- id: example-feed
  url: https://example.com/feed.xml
  site: https://example.com
  title: Example Feed
  description: An example AI/ML feed
  source_type: blog
  topics:
    - llm
    - research
  verified: false
```

**Topics** (`data/topics.yaml`):

```yaml
topics:
  - id: llm
    label: Large Language Models
    description: Models trained on large text corpora
    facet: domain
    aliases: [language-models, transformers, gpt]
    
relations:
  - source_topic_id: llm
    target_topic_id: training
    relation_type: depends_on
    is_directed: true
```

### Validating Data Files

```bash
# Validate feeds.yaml against schema
uv run aiwebfeeds validate schema --file data/feeds.yaml

# Validate topics.yaml against schema
uv run aiwebfeeds validate schema --file data/topics.yaml

# Validate all data files
uv run aiwebfeeds validate all --include-schema
```

### Regenerating Exports

```bash
# Generate all export formats (JSON, OPML)
uv run aiwebfeeds export all

# Generate specific format
uv run aiwebfeeds export json --output data/feeds.json
uv run aiwebfeeds export opml --output data/feeds.opml

# Generate filtered exports
uv run aiwebfeeds export opml --topic llm --output data/llm-feeds.opml
uv run aiwebfeeds export opml --verified-only --output data/verified-feeds.opml
```

______________________________________________________________________

## Quality Checks

### Pre-Commit Checklist

Before committing, ensure all checks pass:

```bash
# 1. Ruff linting (Python)
uv run ruff check --fix .

# 2. Ruff formatting (Python)
uv run ruff format .

# 3. Mypy type checking (Python)
uv run mypy packages/ai_web_feeds/

# 4. Python tests with coverage
uv run pytest --cov=ai_web_feeds --cov-report=term-missing --cov-fail-under=90

# 5. ESLint (TypeScript)
cd apps/web && pnpm lint --fix && cd ../..

# 6. TypeScript type check
cd apps/web && pnpm tsc --noEmit && cd ../..

# 7. Data schema validation
uv run aiwebfeeds validate schema --all

# 8. Next.js build check
cd apps/web && pnpm build && cd ../..
```

### Conventional Commits

All commits MUST follow the Conventional Commits specification:

```bash
# Format: <type>(<scope>): <description>

# Examples:
git commit -m "feat(validate): add feed format detection"
git commit -m "fix(export): handle missing feed title gracefully"
git commit -m "docs(api): update REST API documentation"
git commit -m "test(validate): add edge case tests for feed parsing"
git commit -m "refactor(storage): simplify database query logic"
git commit -m "chore(deps): update httpx to 0.25.0"
```

**Types**:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Test additions/modifications
- `refactor`: Code refactoring (no behavior change)
- `perf`: Performance improvements
- `chore`: Maintenance tasks
- `ci`: CI/CD changes
- `build`: Build system changes

**Scopes**: `validate`, `export`, `enrich`, `storage`, `cli`, `web`, `api`, `docs`,
`test`

______________________________________________________________________

## Troubleshooting

### Common Issues

#### "uv: command not found"

```bash
# Install uv
pip install uv

# Or use the official installer
curl -LsSf https://astral.sh/uv/install.sh | sh

# Add to PATH (if needed)
export PATH="$HOME/.cargo/bin:$PATH"
```

#### "Module 'ai_web_feeds' not found"

```bash
# Ensure virtual environment is activated
source .venv/bin/activate  # Linux/macOS
.venv\Scripts\activate     # Windows

# Or use uv run
uv run python -c "import ai_web_feeds; print(ai_web_feeds.__version__)"

# Re-sync workspace
uv sync --refresh
```

#### "pnpm: command not found"

```bash
# Install pnpm
npm install -g pnpm

# Verify installation
pnpm --version
```

#### "Database locked" Error

```bash
# Close all applications accessing the database
# Delete database file and recreate
rm data/aiwebfeeds.db
uv run aiwebfeeds load data/feeds.yaml
```

#### Type Errors with Mypy

```bash
# Clear mypy cache
rm -rf .mypy_cache/

# Re-run type check
uv run mypy packages/ai_web_feeds/

# Check specific file with verbose output
uv run mypy --verbose packages/ai_web_feeds/src/ai_web_feeds/validate.py
```

#### Next.js Build Failures

```bash
# Clear Next.js cache
cd apps/web
rm -rf .next/
pnpm build

# Check for TypeScript errors
pnpm tsc --noEmit

# Regenerate data assets
cd ../..
uv run aiwebfeeds export all
cd apps/web
pnpm build
```

______________________________________________________________________

## Useful Commands Reference

### Python (uv)

```bash
uv sync                         # Install workspace dependencies
uv sync --upgrade               # Upgrade all dependencies
uv add <package>                # Add package dependency
uv add --dev <package>          # Add dev dependency
uv remove <package>             # Remove dependency
uv run <command>                # Run command in virtual environment
uv pip list                     # List installed packages
uv pip freeze                   # Export installed packages
```

### TypeScript (pnpm)

```bash
pnpm install                    # Install dependencies
pnpm add <package>              # Add package
pnpm add -D <package>           # Add dev dependency
pnpm remove <package>           # Remove package
pnpm update                     # Update dependencies
pnpm run <script>               # Run package.json script
pnpm dev                        # Start development server
pnpm build                      # Build for production
pnpm lint                       # Run linter
```

### Git

```bash
git status                      # Check working tree status
git add .                       # Stage all changes
git commit -m "msg"             # Commit with message
git push                        # Push to remote
git pull                        # Pull from remote
git checkout -b <branch>        # Create and switch to branch
git merge <branch>              # Merge branch
```

______________________________________________________________________

## Next Steps

1. **Read the Constitution**: `.specify/memory/constitution.md`
1. **Review Component AGENTS.md**: Component-specific development patterns
1. **Explore the Specification**: `specs/001-core-project-spec/spec.md`
1. **Check the Data Model**: `specs/001-core-project-spec/data-model.md`
1. **Review API Contracts**: `specs/001-core-project-spec/contracts/openapi.yaml`

______________________________________________________________________

## Getting Help

- **Documentation**: https://aiwebfeeds.com/docs
- **GitHub Issues**: https://github.com/wyattowalsh/ai-web-feeds/issues
- **Contributing Guide**: CONTRIBUTING.md
- **Component Docs**: See `AGENTS.md` files in each component

______________________________________________________________________

*Quickstart Version*: 1.0.0 | *Last Updated*: 2025-10-22
