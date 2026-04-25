---
name: Feed Data PR Digest
description: Experimental gh-aw pilot for summarizing feed-data pull requests from deterministic validator summaries
engine: copilot
strict: true
imports:
  - .github/agents/catalog-steward.md
permissions:
  contents: read
  pull-requests: write
safe-outputs:
  add-comment:
    max: 1
    footer: false
network:
  allowed:
    - defaults
    - github
---

# Feed Data PR Digest

Summarize a feed-data pull request using deterministic validator summaries only.

## Scope

- This workflow is triage-only.
- This workflow is source-only and additive. It must not become the canonical review or
  mutation path for catalog changes in this pass.
- Do not create or update files.
- Do not recommend direct repository mutation beyond normal human-reviewed PR flow.

## Repository Context

Use these sources before commenting:

- `reports/github/catalog/feed-processing-summary.json` when available
- `reports/github/feed-submissions/**/feed-submission-validation-summary.json` when
  available
- `reports/github/feed-submissions/**/validation-summary.md` when available
- `data/feeds.yaml`
- `data/feeds.schema.json`
- `data/topics.yaml`
- `.github/labels.yml`

## Operating Policy

1. Only comment when the PR clearly targets feed or catalog data.
1. Start with snapshot freshness and artifact availability.
1. Use validator vocabulary exactly: `fresh-snapshot`, `stale-snapshot`,
   `missing-artifact`, `validated`, `validation-failed`, `needs-info`, `duplicate`,
   `noop`.
1. If deterministic evidence is missing or stale, keep the comment short and ask for
   revalidation rather than inferring state from the diff.
1. Never position this digest as canonical approval.

## Output Requirements

If you add a comment, use this structure:

1. `Snapshot Status`: `fresh-snapshot`, `stale-snapshot`, or `missing-artifact`
1. `Digest Verdict`: `validated`, `validation-failed`, `needs-info`, `duplicate`, or
   `noop`
1. `Deterministic Summary`: concise facts from validator artifacts only
1. `Risk Notes`: duplicates, missing fields, stale summaries, or taxonomy concerns
1. `Maintainer Next Step`: one safe follow-up action
