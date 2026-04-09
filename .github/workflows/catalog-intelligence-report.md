---
name: Catalog Intelligence Report
description: Experimental gh-aw pilot for weekly catalog intelligence reporting from deterministic summary artifacts
engine: copilot
strict: true
imports:
  - .github/agents/catalog-steward.md
  - .github/prompts/catalog-intelligence-weekly-report.prompt.md
permissions:
  contents: read
  issues: write
safe-outputs:
  create-issue:
    max: 1
    title-prefix: "[gh-aw] "
    labels:
      - automated
      - component/data
      - status/needs-review
    close-older-issues: true
    footer: false
network:
  allowed:
    - defaults
    - github
---

# Catalog Intelligence Report

Generate at most one maintainer-facing weekly catalog report issue from deterministic
summary artifacts.

## Scope

- This workflow is report-only.
- This workflow is source-only and additive. It must not become the canonical mutation
  path for catalog changes in this pass.
- Do not create a pull request.
- Do not request direct repository mutation.
- Prefer a no-op over weak or stale conclusions.

## Repository Context

Use these files as the source of truth before making any recommendation:

- `reports/github/catalog/feed-processing-summary.json` when available
- `data/feeds.yaml`
- `data/feeds.schema.json`
- `data/topics.yaml`
- `.github/labels.yml`
- `.github/prompts/catalog-intelligence-weekly-report.prompt.md`

## Operating Policy

1. Start by checking whether the deterministic catalog snapshot is `fresh-snapshot`,
   `stale-snapshot`, or `missing-artifact`.
1. Use validator vocabulary exactly: `fresh-snapshot`, `stale-snapshot`,
   `missing-artifact`, `gap-report-only`, `candidates-found`, `noop`.
1. If the snapshot is stale or missing, downgrade to a gap-focused report instead of
   asserting current catalog facts.
1. Keep the report operational and maintainer-facing.
1. Never recommend direct mutation; the handoff remains human-reviewed PRs and
   deterministic validation.

## Output Requirements

If you create an issue, use this structure:

1. `Snapshot Status`: `fresh-snapshot`, `stale-snapshot`, or `missing-artifact`
1. `Report Status`: `candidates-found`, `gap-report-only`, or `noop`
1. `Catalog Health Summary`: source count, freshness, and topic-shape observations
1. `Priority Gaps`: up to 3 coverage or quality gaps worth addressing next
1. `Validation Queue Notes`: stale submissions, duplicate risk, or review backlog
1. `Maintainer Next Step`: the smallest safe follow-up action
