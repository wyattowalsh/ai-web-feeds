# GitHub Actions Workflows Documentation

This document describes all GitHub Actions workflows in the AI Web Feeds project and how
they utilize the CLI.

## 📋 Table of Contents

- [Quality Workflows](#quality-workflows)
- [Validation Workflows](#validation-workflows)
- [Automation Workflows](#automation-workflows)
- [Release, Security, and Dependency Automation](#-release-security-and-dependency-automation)
- [CLI Integration](#cli-integration)
- [Quality Standards](#quality-standards)

______________________________________________________________________

## 🎯 Quality Workflows

### `quality-enforcement.yml` 🆕

**Purpose**: Comprehensive quality gate enforcing all project standards.

**Triggers**:

- Pull requests to `main` or `develop`
- Pushes to `main` or `develop`

**Jobs**:

1. **enforce-formatting**: Ensures code is properly formatted

   - CLI: `uv run format --check`
   - Standard: Ruff formatting rules

1. **enforce-linting**: Enforces linting standards

   - CLI: `uv run lint`
   - Standard: Ruff linting rules (ANN, D, E, F, etc.)

1. **enforce-type-checking**: Publishes MyPy findings without blocking merges

   - CLI: `uv run typecheck`
   - Standard: MyPy strict mode, advisory while legacy debt is reduced

1. **enforce-testing**: Verifies test coverage ≥90%

   - CLI: `uv run aiwebfeeds test coverage --html`
   - Standard: 90% minimum coverage

1. **enforce-data-validation**: Validates canonical data assets and generated
   derivatives

   - Script: `uv run python data/validate_data_assets.py`
   - Standard: JSON Schema compliance plus canonical export freshness

1. **quality-gate**: Final gate requiring hard checks to pass

   - Blocks merge if formatting, linting, tests, or data validation fail
   - Posts comprehensive status to PR

**Output**:

- Detailed PR comments with pass/fail status
- Artifacts for all reports
- Prevents merge on failure

______________________________________________________________________

### `python-quality.yml` (Enhanced)

**Purpose**: Multi-platform Python code quality checks.

**Triggers**:

- Changes to `.py` files
- Changes to `pyproject.toml` or `uv.lock`

**Jobs**:

1. **lint-and-format**: Ruff linting and formatting

   - CLI: `uv run ruff check .` + `uv run ruff format --check .`
   - Outputs: GitHub annotations, JSON/text reports

1. **type-check**: MyPy type validation report

   - CLI: `uv run mypy`
   - Outputs: JUnit XML, HTML reports
   - Advisory while strict typing backlog is burned down

1. **security-check**: Bandit security scanning

   - CLI: `uv run bandit`
   - Outputs: JSON/text security reports

1. **test**: Cross-platform testing (Ubuntu, macOS, Windows)

   - CLI: `uv run aiwebfeeds test coverage --html`
   - Coverage uploaded to Codecov
   - Enforces 90% threshold

1. **quality-gate**: Aggregates hard-gate results

   - Fails if lint/format, security, or tests fail

______________________________________________________________________

### `coverage.yml` (Enhanced)

**Purpose**: Detailed coverage reporting, comments, and badge tracking.

**Triggers**:

- Pushes to `main`
- Pull requests to `main`
- Manual workflow dispatch
- Runs when Python files, `pyproject.toml`, `uv.lock`, or the workflow itself change

**CLI Commands**:

- `cd tests && uv run pytest -q tests/cli tests/packages/ai_web_feeds/unit --ignore=tests/packages/ai_web_feeds/unit/test_nlp_entity_extractor.py --ignore=tests/packages/ai_web_feeds/unit/test_nlp_sentiment_analyzer.py --ignore=tests/packages/ai_web_feeds/unit/test_nlp_topic_modeler.py`
- `cd tests && uv run coverage xml -o reports/coverage/coverage.xml`
- `cd tests && uv run coverage report --format=markdown`

**Features**:

- Generates HTML coverage reports
- Posts coverage comments on PRs
- Uploads to Codecov
- Creates coverage badges when `GIST_SECRET` and `COVERAGE_GIST_ID` are configured
- Reports the 90% minimum threshold status
- Complements `python-quality.yml` and `quality-enforcement.yml`, which remain the merge
  gates

______________________________________________________________________

## ✅ Validation Workflows

### `pr-validation.yml` (Enhanced)

**Purpose**: Validate PRs for data and code changes.

**Triggers**: Pull requests changing data or Python files

**Jobs**:

1. **validate-data**: Validate YAML data files

   - CLI: `uv run aiwebfeeds validate all --strict`
   - Checks feeds.yaml, topics.yaml schemas
   - Validates topic references
   - Checks for duplicate IDs

1. **lint-check**: Quick code quality check

   - CLI: `uv run ruff check .` + `uv run ruff format --check .`
   - Only runs if Python files changed

1. **test-check**: Quick test validation

   - CLI: `uv run aiwebfeeds test quick`
   - Fast unit tests only
   - Fails fast on errors

**Output**: PR comments with validation results

______________________________________________________________________

### `validate-all-feeds.yml` (Enhanced)

**Purpose**: Comprehensive feed validation (scheduled + manual).

**Triggers**:

- Weekly schedule (Sundays at 2am UTC)
- Manual workflow dispatch

**CLI Commands**:

- `uv run aiwebfeeds validate all --strict` (or `--lenient`)
- `uv run aiwebfeeds stats show --format json`

**Workflow Inputs**:

- `check_accessibility`: Check feed URL accessibility
- `strict_mode`: Use strict validation (default: true)

**Output**: Validation reports as artifacts

______________________________________________________________________

## 🤖 Automation Workflows

### Experimental Agentic Workflow Sources

The repository now also contains experimental GitHub Agentic Workflows source files in
`.github/workflows/*.md`.

- These files are **not active** until they are compiled and reviewed.
- Existing `.yml` workflows remain the production source of truth.
- Agentic workflow pilots should begin with read-only or tightly-scoped automation
  before replacing active CI/CD logic.
- Reusable custom agents for these workflows live in `.github/agents/`.

Current experimental source files:

- `feed-submission-review.md`: read-only feed submission triage and validation pilot
- `feed-discovery-report.md`: weekly report-only discovery pilot for topic gaps and
  candidate leads
- `catalog-intelligence-report.md`: weekly catalog-health distillation pilot
- `feed-data-pr-digest.md`: deterministic pull-request digest pilot for feed data
  changes

The discovery pilot intentionally avoids `feed-submission`, `approved`, and other
submission-path labels because deterministic feed intake now relies on a
maintainer-controlled validated snapshot before any PR-based mutation can occur.

Deterministic YAML workflows remain canonical and now expose additive evidence for gh-aw
under extracted `reports/github/...` paths inside workflow artifacts. Those paths are
distillation inputs only: they are not checked-in catalog state and do not replace the
live YAML mutation path.

### `auto-fix.yml` (Enhanced)

**Purpose**: Automatically fix code quality issues.

**Triggers**: Pull requests with Python changes

**CLI Commands**:

- `uv run fix` (runs `lint-fix` + `format`)

**Process**:

1. Checks out PR branch
1. Runs auto-fix commands
1. Commits changes if any
1. Posts detailed comment with changed files

**Output**: Automatic commits to PR with fixes

______________________________________________________________________

### Other Workflows

**`codeql-analysis.yml`**: GitHub CodeQL security scanning

**`dependency-review.yml`**: Reviews dependency changes

**`dependency-updates.yml`**: Automated dependency updates

**`greet-contributors.yml`**: Welcomes new contributors

**`label-manager.yml`**: Manages issue/PR labels

**`release-drafter.yml`**: Drafts release notes

**`release.yml`**: Publishes releases

**`stale.yml`**: Manages stale issues/PRs

**`sync-labels.yml`**: Syncs repository labels

**`validate-feed-submission.yml`**: Validates new feed submissions

**`add-approved-feed.yml`**: Adds approved feeds to data

______________________________________________________________________

## 🔐 Release, Security, and Dependency Automation

### Release automation

- **`release-drafter.yml`** keeps a draft release updated from `main` pushes plus
  selected PR label changes, and `.github/release-drafter.yml` now tracks the current
  docs and dependency paths (`apps/web/content/docs/**/*`, `uv.lock`, and the web
  manifests).
- **`release.yml`** publishes only from `v*.*.*` tags and uses GitHub OIDC trusted
  publishing for PyPI. Manual `workflow_dispatch` runs still execute the build path, but
  the publish and GitHub release steps remain tag-only.
- Release build artifacts upload even after a publish failure so maintainers can inspect
  the exact distributions from the attempted release job before retrying.
- Docker publishes in `ci.yml` consume digest-pinned base images from `Dockerfile`,
  which keeps image builds tied to immutable upstream inputs until attestation support
  is added.

### Security automation

- **`codeql-analysis.yml`** scans Python plus the web app's JavaScript/TypeScript on
  `main`/`develop`, runs weekly, and supports manual dispatch. Documentation and
  non-code data assets are ignored to reduce noise.
- **`dependency-review.yml`** runs only when tracked Python or web dependency
  manifests/lockfiles change across the workspace. It blocks moderate-or-higher
  advisories and GPL-3.0/AGPL-3.0 additions, and posts a PR summary when permissions
  allow.
- **`python-quality.yml`** still runs Bandit, while `ci.yml` continues Trivy filesystem
  scans for broader supply-chain and container coverage.

### Dependency automation

- **`dependency-updates.yml`** runs weekly or manually, serializes runs with
  workflow-level concurrency, and limits bot PR contents to `uv.lock` or
  `.pre-commit-config.yaml`.
- Bot PR creation prefers `GH_AW_CI_TRIGGER_TOKEN` when present, then falls back to
  `GITHUB_TOKEN`, and emits warnings when repository policy blocks write access.

______________________________________________________________________

## 🔧 CLI Integration

All enhanced workflows utilize the `aiwebfeeds` CLI for consistency.

### Test Commands

```bash
uv run aiwebfeeds test all              # All tests
uv run aiwebfeeds test unit             # Unit tests only
uv run aiwebfeeds test integration      # Integration tests
uv run aiwebfeeds test e2e              # E2E tests
uv run aiwebfeeds test coverage --html  # With coverage
uv run aiwebfeeds test quick            # Fast unit tests
```

### Validation Commands

```bash
uv run aiwebfeeds validate feeds --input data/feeds.yaml --schema data/feeds.schema.json
uv run aiwebfeeds validate topics --input data/topics.yaml --schema data/topics.schema.json
uv run aiwebfeeds validate references
uv run aiwebfeeds validate all          # All validations
uv run aiwebfeeds validate all --strict # Strict mode
uv run aiwebfeeds validate url "https://example.com/feed.xml"
```

### Quality Commands (via uv scripts)

```bash
uv run lint                             # Run linter
uv run lint-fix                         # Auto-fix issues
uv run format                           # Format code
uv run format --check                   # Check formatting
uv run typecheck                        # Type checking
uv run check                            # All checks
uv run fix                              # Auto-fix all
```

### Stats Commands

```bash
uv run aiwebfeeds stats                 # Display stats
uv run aiwebfeeds stats show --format json
```

______________________________________________________________________

## 📏 Quality Standards

### Enforced Standards

1. **Code Formatting**: Ruff format (100 char lines)
1. **Linting**: Ruff with ANN, D, E, F, I, N, UP, etc.
1. **Type Hints**: MyPy strict mode, all functions typed
1. **Test Coverage**: ≥90% required
1. **Data Validation**: JSON Schema compliance
1. **Security**: Bandit scanning
1. **Cross-platform**: Ubuntu, macOS, Windows support

### Quality Gate

The `quality-gate` job in workflows ensures:

- ✅ All formatting rules pass
- ✅ All linting rules pass
- ✅ All type checks pass
- ✅ Coverage ≥90%
- ✅ All data validations pass

**If any check fails, the PR cannot be merged.**

______________________________________________________________________

## 🚀 Local Development

### Before Committing

```bash
# Run core quality checks
uv run ruff check . --output-format=github
uv run ruff format --check .
uv run mypy packages/ai_web_feeds/src apps/cli/ai_web_feeds tests
uv run python data/validate_data_assets.py
cd tests && uv run pytest -q tests/cli tests/packages/ai_web_feeds/unit --ignore=tests/packages/ai_web_feeds/unit/test_nlp_entity_extractor.py --ignore=tests/packages/ai_web_feeds/unit/test_nlp_sentiment_analyzer.py --ignore=tests/packages/ai_web_feeds/unit/test_nlp_topic_modeler.py

# Run tests
uv run aiwebfeeds test all

# Validate data
uv run aiwebfeeds validate all
```

### Pre-commit Hook (Recommended)

Install pre-commit hooks to run checks automatically:

```bash
uv tool install pre-commit
pre-commit install
```

______________________________________________________________________

## 📊 Workflow Artifacts

Workflows generate artifacts for review:

- **Ruff Reports**: JSON and text linting reports
- **MyPy Reports**: JUnit XML and HTML type reports
- **Bandit Reports**: JSON and text security reports
- **Test Reports**: JUnit XML and pytest reports
- **Coverage Reports**: HTML coverage reports
- **Validation Reports**: JSON validation statistics

**Retention**: 7-30 days depending on report type

______________________________________________________________________

## 🔄 Continuous Improvement

### Workflow Updates

When updating workflows:

1. Test locally with `act` (GitHub Actions local runner)
1. Update this documentation
1. Add CLI commands where appropriate
1. Maintain consistency across workflows
1. Update AGENTS.md files as needed

### Adding New Checks

To add new quality checks:

1. Add command to CLI if applicable
1. Add job to `quality-enforcement.yml`
1. Update quality gate dependencies
1. Document in this file
1. Update project README

______________________________________________________________________

## 📝 Workflow Debugging

### Common Issues

**Issue**: Workflow fails with "CLI command not found"

- **Solution**: Ensure `uv sync --all-extras` is run first

**Issue**: Coverage below 90%

- **Solution**: Add tests or update coverage threshold

**Issue**: Data validation fails

- **Solution**: Run `uv run aiwebfeeds validate all` locally

**Issue**: Formatting/linting fails

- **Solution**: Run `uv run fix` to auto-fix

### Logs and Reports

Check workflow run artifacts for detailed reports:

1. Go to Actions tab
1. Select workflow run
1. Download artifacts
1. Review JSON/HTML reports

______________________________________________________________________

## 🔗 Related Documentation

- [CLI Documentation](../../apps/cli/AGENTS.md)
- [Testing Documentation](../../tests/AGENTS.md)
- [Contributing Guidelines](../../CONTRIBUTING.md)
- [Project AGENTS.md](../../AGENTS.md)

______________________________________________________________________

*Last Updated: April 2026*
