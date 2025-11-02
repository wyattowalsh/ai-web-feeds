# GitHub Actions Workflows Documentation

This document describes all GitHub Actions workflows in the AI Web Feeds project and how
they utilize the CLI.

## 📋 Table of Contents

- [Quality Workflows](#quality-workflows)
- [Validation Workflows](#validation-workflows)
- [Automation Workflows](#automation-workflows)
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

1. **enforce-type-checking**: Validates type hints

   - CLI: `uv run typecheck`
   - Standard: MyPy strict mode

1. **enforce-testing**: Verifies test coverage ≥90%

   - CLI: `uv run aiwebfeeds test coverage --html`
   - Standard: 90% minimum coverage

1. **enforce-data-validation**: Validates data files

   - CLI: `uv run aiwebfeeds validate all --strict`
   - Standard: JSON Schema compliance

1. **quality-gate**: Final gate requiring all checks to pass

   - Blocks merge if any check fails
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

1. **type-check**: MyPy type validation

   - CLI: `uv run mypy`
   - Outputs: JUnit XML, HTML reports

1. **security-check**: Bandit security scanning

   - CLI: `uv run bandit`
   - Outputs: JSON/text security reports

1. **test**: Cross-platform testing (Ubuntu, macOS, Windows)

   - CLI: `uv run aiwebfeeds test coverage --html`
   - Coverage uploaded to Codecov
   - Enforces 90% threshold

1. **quality-gate**: Aggregates all results

   - Fails if any job fails

______________________________________________________________________

### `coverage.yml` (Enhanced)

**Purpose**: Detailed coverage reporting and tracking.

**Triggers**:

- Pushes to `main`
- Pull requests to `main`

**CLI Commands**:

- `uv run aiwebfeeds test coverage --html`

**Features**:

- Generates HTML coverage reports
- Posts coverage comments on PRs
- Uploads to Codecov
- Creates coverage badges (optional)
- Enforces 90% minimum threshold

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
- `uv run aiwebfeeds stats --output json`

**Workflow Inputs**:

- `check_accessibility`: Check feed URL accessibility
- `strict_mode`: Use strict validation (default: true)

**Output**: Validation reports as artifacts

______________________________________________________________________

## 🤖 Automation Workflows

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
uv run aiwebfeeds validate feeds        # Validate feeds.yaml
uv run aiwebfeeds validate topics       # Validate topics.yaml
uv run aiwebfeeds validate references   # Validate topic refs
uv run aiwebfeeds validate all          # All validations
uv run aiwebfeeds validate all --strict # Strict mode
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
uv run aiwebfeeds stats --output json   # JSON output
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
# Run all quality checks
uv run check

# Auto-fix issues
uv run fix

# Run tests
uv run aiwebfeeds test all

# Validate data
uv run aiwebfeeds validate all
```

### Pre-commit Hook (Recommended)

Install pre-commit hooks to run checks automatically:

```bash
uv pip install pre-commit
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

*Last Updated: October 2025*
