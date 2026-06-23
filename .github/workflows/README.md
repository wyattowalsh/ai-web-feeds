# GitHub Actions Workflows

Active GitHub Actions workflows are defined in `.github/workflows/*.yml`.

`.github/workflows/*.md` files are experimental GitHub Agentic Workflows (gh-aw)
**sources** and are not active until compiled into a lock workflow and reviewed.
Existing `.yml` workflows are the production source of truth. See `.github/AGENTS.md`.

### gh-aw Sources (`.md`, inactive)

- `feed-submission-review.md`: Experimental read-only pilot for feed submission
  triage/validation (labels: automation, feed-submission, gh-aw-pilot).
- `feed-discovery-report.md`: Experimental report-only weekly discovery pilot for topic
  gaps (schedule + dispatch; creates issues with `[gh-aw]` prefix).

These are kept separate from active `.yml` per `.github/AGENTS.md`.

## Quality

### ci.yml

**Triggers**:

- `pull_request` → `main`, `develop`
- `push` → `main`, `develop`

**Concurrency**: cancel-in-progress per workflow+ref.

**Jobs**:

- `workflow-lint`: `rhysd/actionlint@v1.7.12`
- `python-quality`:
  - `uv run ruff check` (targeted smoke files under
    `apps/cli/ai_web_feeds/cli/commands/` and `packages/ai_web_feeds/src/ai_web_feeds/`)
  - `uv run ruff format --check` (same targets)
  - `uv run ty check` (same targets)
  - `uv run bandit` (same targets, `-c pyproject.toml`)
- `python-tests`:
  - `cd tests && uv run pytest -q` (targeted smoke test files)
- `web-quality`:
  - pnpm install (apps/web)
  - `pnpm --dir apps/web lint`
  - `pnpm --dir apps/web exec next typegen`
  - `pnpm --dir apps/web exec tsc --noEmit`
  - `pnpm --dir apps/web test:unit`
  - `CI=1 pnpm --dir apps/web build`
- `web-e2e` (PRs only, needs `web-quality`):
  - Playwright install + `pnpm --dir apps/web test`
  - Upload `playwright-report/` artifact (14 days)

### quality-enforcement.yml

**Name**: Quality Enforcement (Manual)

**Triggers**: `workflow_dispatch`

**Jobs**:

- `quality-gate` (ubuntu-latest):
  - Checkout, `astral-sh/setup-uv`, `actions/setup-python@v5` (3.13),
    `uv sync --all-extras`
  - `uv run ruff check .`
  - `uv run ruff format --check .`
  - `uv run ty check` (targeted smoke files)
  - `cd tests && uv run pytest -q`

### python-quality.yml

**Name**: Python Quality (Manual)

**Triggers**: `workflow_dispatch`, `workflow_call`

**Jobs**:

- `python-quality` (ubuntu-latest):
  - Checkout, uv + py 3.13, `uv sync --all-extras`
  - `uv run ruff check .`
  - `uv run ruff format --check .`
  - `uv run ty check` (targeted smoke files)
  - `uv run bandit -r packages/ai_web_feeds/src apps/cli/ai_web_feeds -c pyproject.toml`

### coverage.yml

**Name**: Coverage Report

**Triggers**:

- `push` → `main`
- `workflow_dispatch`

**Jobs**:

- `coverage` (ubuntu-latest):
  - Checkout, uv + py 3.13, `uv sync --all-extras`
  - `cd tests && uv run pytest -q` (targeted smoke tests)
  - `uv run coverage xml -o reports/coverage/coverage.xml`
  - `uv run coverage report`
  - `uv run coverage report --format=markdown > ../coverage-summary.md`
  - Upload artifact `coverage-reports` (reports/coverage/ + summary.md, 30 days)

### auto-fix.yml

**Name**: Auto-fix Code Issues

**Triggers**:

- `pull_request` paths: `**.py`, `pyproject.toml`

**Permissions**: `contents: write`, `pull-requests: write`

**Jobs**:

- `auto-fix` (only if PR head repo matches repository):
  - Checkout PR ref + token
  - uv + py 3.13, `uv sync --all-extras`
  - `uv run fix`
  - If changes: commit as `github-actions[bot]` with message
    `style: auto-fix code with ruff [skip ci]`, push
  - If changes: post PR comment listing changed files (via `actions/github-script@v7`)

## Validation

### pr-validation.yml

**Name**: Data Submission Validation

**Triggers**:

- `pull_request` (opened, synchronize, reopened)
- Paths: `data/feeds.yaml`, `data/feeds.enriched.yaml`, `data/topics.yaml`,
  `data/*.schema.json`, `data/validate_data_assets.py`

**Jobs**:

- `validate-data`:
  - Checkout, uv + py 3.13, `uv sync --all-extras`
  - `uv run python data/validate_data_assets.py`

### validate-all-feeds.yml

**Name**: Validate All Feeds

**Triggers**:

- `schedule`: `0 2 * * 0` (Sundays 02:00 UTC)
- `workflow_dispatch` inputs:
  - `check_accessibility`: boolean (default: false)
  - `strict_mode`: boolean (default: true)

**Jobs**:

- `validate-with-cli`:
  - Checkout, uv + py 3.13, `uv sync --all-extras`
  - `uv run python data/validate_data_assets.py`
  - `uv run ai-web-feeds validate all --lenient` (if strict_mode=false) or `--strict`
  - Inline Python: duplicate ID checks, required fields (`id`, url/feed/site), topic
    validity against `topics.yaml`, topic count ≤6, tag count ≤12; writes
    `validation_summary.json`; exits 1 on issues
  - If `check_accessibility`: parallel requests + feedparser checks across sources
  - Always: upload `validation-report` artifact (30 days)
  - Always: `actions/github-script@v7` writes summary counts to workflow summary

### validate-feed-submission.yml

**Name**: Validate Feed Submission

**Triggers**: `issues` (opened, edited)

**Jobs**:

- `validate-feed` (only if issue has label `feed-submission`):
  - Checkout, uv + py 3.13
  - `actions/github-script@v7`: parse issue form fields (regex on `### ` sections),
    extract id/feed/site/title/topics/mediums/etc., write `parsed_feed.json`, comment
    parsed data
  - Run Python: load `data/feeds.schema.json`, validate minimal document via
    `jsonschema`; write result file
  - Run Python (`--with requests --with feedparser`): optional feed URL accessibility +
    parse test
  - Always: post result comment; add label `validated` or `validation-failed`

### add-approved-feed.yml

**Name**: Add Approved Feed to Registry

**Triggers**: `issues` (labeled)

**Jobs**:

- `add-feed` (if `label.name == 'approved'`):
  - Permissions: contents, issues, pull-requests write
  - Checkout with token
  - `actions/github-script@v7`: parse issue, build feed entry, load `data/feeds.yaml`,
    reject duplicate ID, append source + update `document_meta.updated`, write file
  - `peter-evans/create-pull-request@v6`: branch `feed-submission-{number}`, commit,
    title "Add feed: ...", body, labels `feed-submission`, `automated`
  - Comment on issue

### process-feeds.yml

**Name**: Feed Processing Pipeline

**Triggers**:

- `push` → `main` (paths: `data/feeds.yaml`, `data/topics.yaml`,
  `packages/ai_web_feeds/**`, `apps/cli/**`)
- `pull_request` (paths: `data/feeds.yaml`, `data/topics.yaml`)
- `workflow_dispatch` inputs:
  - `skip_enrichment`: boolean (default: true)
  - `export_formats`: boolean (default: true)

**Permissions**: `contents: write`, `pull-requests: write`

**Jobs**:

- `process-feeds`:
  - Checkout (fetch-depth: 0), py 3.13
  - uv sync in `packages/ai_web_feeds` and `apps/cli` separately
  - Inline Python: validate `feeds.yaml` (schema_version=`feeds-3.0.0`, sources
    non-empty list, each has `url` http(s), 1-6 unique string topics, title/notes length
    constraints); fail on errors
  - `cd apps/cli && uv run ai-web-feeds process --input ../../data/feeds.yaml --output ../../data/feeds.enriched.yaml --database sqlite:///../../data/ai-web-feeds.db [--skip-enrichment] [--export|--no-export]`
  - Verify: list generated files, source counts (from json), run
    `data/validate_data_assets.py`, sqlite table/source queries
  - On `push` to `main`: commit generated files (`feeds.enriched.yaml`, `feeds.json`,
    `*.opml`, `ai-web-feeds.db`) with `[skip ci]`
  - Always: upload `processed-feeds` artifact (30 days)
  - On PR: `actions/github-script` posts comment with source count + file sizes

## Automation

### label-manager.yml

**Name**: Label Manager

**Triggers**:

- `issues` (opened)
- `pull_request` (opened)

**Jobs**:

- `auto-label`:
  - Issues: size (body length), component (CLI/web/schema/docs keywords in body),
    priority (urgent/critical/blocking)
  - PRs: scan changed files via `pulls.listFiles`; component labels by path
    (`apps/cli/`, `apps/web/`, `packages/`, `data/`, `.github/`, `test`, `schema`,
    `docs`); size by total delta

### greet-contributors.yml

**Name**: Greet New Contributors

**Triggers**:

- `issues` (opened)
- `pull_request_target` (opened)

**Jobs**:

- `greet`:
  - Search issues/PRs by author; if total_count==1 (first contribution): post welcome
    comment (issue vs PR variant) + add `first-time-contributor` label (issues only);
    PRs receive review comment

### sync-labels.yml

**Name**: Sync Labels

**Triggers**:

- `push` → `main` paths: `.github/labels.yml`
- `workflow_dispatch`

**Jobs**:

- `sync-labels`: `micnncim/action-label-syncer@v1` (manifest: `.github/labels.yml`,
  `prune: false`)

### stale.yml

**Name**: Stale Issues and PRs

**Triggers**:

- `schedule`: `0 0 * * 0`
- `workflow_dispatch`

**Jobs**:

- `stale` (`actions/stale@v9`):
  - Issues: stale 60d, close 14d; messages, label `stale`, exempt:
    `keep-open,pinned,security,good-first-issue`
  - PRs: stale 30d, close 7d; messages, exempt: `keep-open,pinned,security,in-progress`
  - `operations-per-run: 100`, `remove-stale-when-updated: true`

### dependency-updates.yml

**Name**: Dependency Updates

**Triggers**:

- `schedule`: `0 9 * * 1` (Mondays 09:00 UTC)
- `workflow_dispatch`

**Jobs**:

- `update-dependencies`:
  - `uv lock --upgrade`
  - `peter-evans/create-pull-request@v7` (token prefers `GH_AW_CI_TRIGGER_TOKEN` else
    `GITHUB_TOKEN`; labels `dependencies,automated`; continue-on-error)
- `update-pre-commit`:
  - `uv sync --all-extras`, `uv run pre-commit autoupdate`
  - create-pr (similar)

### release-drafter.yml

**Name**: Release Drafter

**Triggers**:

- `push` → `main`
- `pull_request` (opened, reopened, synchronize)

**Jobs**:

- `update_release_draft`: `release-drafter/release-drafter@v6` (config:
  `release-drafter.yml`)

## Security/Release

### release.yml

**Name**: Release

**Triggers**:

- `push` tags: `v*.*.*`
- `workflow_dispatch` (input: `version`)

**Jobs**:

- `quality-checks`:
  - uv + py 3.13, sync `--extra dev`
  - `uv run ruff check .`, format `--check`, `ty check` (smoke), `uv run pytest --cov`
- `build-and-publish` (needs: quality-checks):
  - `cd packages/ai_web_feeds && uv build`; same for `apps/cli`
  - If tag: `uv publish` each (env `UV_PUBLISH_TOKEN`)
  - Upload `dist-packages` artifact
- `create-release` (needs: build-and-publish; only on tag):
  - Download artifact, generate `release_notes.md` (git log since prev tag)
  - `softprops/action-gh-release@v2` (attach dist files)

### dependency-review.yml

**Name**: Dependency Review

**Triggers**: `pull_request`

**Jobs**:

- `dependency-review`:
  - `actions/dependency-review-action@v4` (`continue-on-error: true`,
    `fail-on-severity: moderate`, `deny-licenses: GPL-3.0, AGPL-3.0`,
    `comment-summary-in-pr: always`)

### codeql-analysis.yml

**Name**: CodeQL Analysis

**Triggers**:

- `push` → `main,develop`
- `pull_request` → `main`
- `schedule`: `0 6 * * 1` (Mondays 06:00 UTC)

**Jobs**:

- `analyze` (matrix: javascript, python; `fail-fast: false`):
  - Permissions: actions read, contents read, security-events write
  - `github/codeql-action/init@v3` (languages + queries:
    security-extended,security-and-quality)
  - autobuild
  - `github/codeql-action/analyze@v3`

______________________________________________________________________

*Reconciled to actual `.yml` files (triggers, jobs, commands) on 2026-06-23.
Aspirational content removed.*
