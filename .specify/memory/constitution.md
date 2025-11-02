# AI Web Feeds Constitution

## Core Principles

### I. Documentation-First Delivery (MUST)

- All feature documentation MUST live in `apps/web/content/docs/*.mdx` with valid
  frontmatter.
- `meta.json` MUST be updated whenever new docs are added.
- Standalone `.md` documentation outside the allowed root files is PROHIBITED.

### II. Client-Side Integrity (MUST)

- Specifications that declare “client-side only” MUST NOT introduce new backend services
  or API contracts without an approved spec amendment.
- Browser storage (IndexedDB/localStorage/Cache Storage) MUST be the system of record
  for client-only phases.
- Service Worker and Web Worker usage MUST degrade gracefully when unsupported.

### III. Test-First Quality Gates (MUST)

- Every change MUST be accompanied by failing tests first, followed by implementation
  and refactor (Red-Green-Refactor).
- Automated test coverage MUST stay ≥90% overall; new modules require matching coverage.
- Type checking (mypy/TypeScript strict) and linting (Ruff/ESLint) MUST pass before
  delivery.

### IV. Package Manager Enforcement (MUST)

- Python execution MUST use `uv run python` or `uv run <command>` (NEVER bare `python`,
  `pip`, `pip install`, `python -m pip`, `poetry`).
- Node.js package management MUST use `pnpm` (NEVER `npm`, `npm install`, `yarn`).
- Rationale: `uv run python` ensures consistent environment isolation and correct
  virtualenv activation; `uv` is 10-100x faster than pip; `pnpm` uses efficient disk
  space with symlinks and has better monorepo support.

### V. Performance & Reliability Contracts (SHOULD)

- Critical interactions SHOULD respond within 16 ms; search operations SHOULD remain
  \<50 ms for 10k items.
- Offline capabilities SHOULD function for 100% of cached content; failures MUST present
  user-facing fallbacks.
- Data export/import SHOULD complete within 5 s for 50 MB datasets.

### VI. Privacy & Data Ownership (MUST)

- User data MUST remain local unless an explicit opt-in export occurs.
- Debug telemetry MUST require explicit user action to share; silent uploads are
  forbidden.
- Data exports MUST support JSON, CSV, OPML, and HTML formats for portability.

## Delivery Workflow

- `/speckit.specify`, `/speckit.plan`, `/speckit.tasks`, and `/speckit.analyze` MUST run
  sequentially; later stages rely on complete artifacts from previous stages.
- Research clarifications MUST be captured in `research.md` before design work begins.
- Task lists MUST map each functional/non-functional requirement to at least one
  actionable item, including fallbacks, recovery flows, and measurement tasks.

## Governance

- This constitution supersedes conflicting specs, plans, and tasks; conflicts MUST be
  resolved by updating those artifacts, not by ignoring principles.
- Amendments require consensus from the feature owner and project maintainer,
  accompanied by version bump and changelog entry.
- Compliance checks MUST be documented during `/speckit.plan` and re-validated before
  `/speckit.implement`.

**Version**: 1.0.1 | **Ratified**: 2025-10-27 | **Last Amended**: 2025-11-02
