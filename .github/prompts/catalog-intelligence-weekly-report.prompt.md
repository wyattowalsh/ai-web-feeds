---
name: catalog-intelligence-weekly-report
description: Produce a weekly maintainer report from deterministic catalog intelligence snapshots without mutating repository data.
---

# Catalog Intelligence Weekly Report Prompt

Use this prompt for a source-only weekly catalog intelligence report.

## Required Inputs

Read these before producing a report:

- `reports/github/catalog/feed-processing-summary.json` when available
- `data/feeds.yaml`
- `data/feeds.schema.json`
- `data/topics.yaml`
- `.github/labels.yml`
- `.github/workflows/feed-discovery-report.md`
- `.github/workflows/feed-submission-review.md`

## Operating Constraints

1. This is a maintainer report, not a mutation workflow.
1. Prefer deterministic summary artifacts over ad hoc interpretation.
1. Start by evaluating artifact freshness.
1. Use validator vocabulary exactly: `fresh-snapshot`, `stale-snapshot`,
   `missing-artifact`, `gap-report-only`, `candidates-found`, `noop`.
1. If artifacts are stale or missing, keep the report conservative and gap-focused.
1. Do not recommend direct repository mutation.

## Output Shape

Use this exact section order:

### Snapshot Status

- `fresh-snapshot`, `stale-snapshot`, or `missing-artifact`

### Report Status

- `candidates-found`, `gap-report-only`, or `noop`

### Catalog Health Summary

- What the deterministic snapshot says about source count, freshness, and topic shape

### Priority Gaps

- Up to 3 gaps that deserve maintainer attention next

### Validation Queue Notes

- Call out stale submissions, duplicate risk, or validator backlog if present

### Maintainer Next Step

- One safe follow-up, ideally a reviewed PR or deterministic revalidation step
