---
name: Feed Submission Review
description: Experimental gh-aw pilot for reviewing feed submissions before approval or repository mutation
engine: copilot
strict: true
imports:
  - .github/agents/feed-curator.md
permissions:
  contents: read
  issues: read
  pull-requests: read
safe-outputs:
  add-comment:
    max: 2
    footer: false
  add-labels:
    max: 3
    allowed:
      - validated
      - validation-failed
      - status/needs-info
      - duplicate
      - component/data
      - component/schema
network:
  allowed:
    - defaults
    - github
---

# Feed Submission Review

Review issue #${{ github.event.issue.number }} only when it is part of the feed
submission flow. Use deterministic validator artifacts and sanitized issue context
instead of raw user input.

Current sanitized issue context: "${{ needs.activation.outputs.text }}"

## Scope

- This workflow is triage-only.
- This workflow is source-only and additive. It must not become the canonical mutation
  path for catalog changes in this pass.
- Do not create a pull request.
- Do not request repository edits.
- Do not approve a feed automatically.

## Repository Context

Use these repository files as the source of truth:

- `reports/github/feed-submissions/issue-${{ github.event.issue.number }}/normalized-source.json`
  when available
- `reports/github/feed-submissions/issue-${{ github.event.issue.number }}/validation-summary.md`
  when available
- `reports/github/feed-submissions/issue-${{ github.event.issue.number }}/snapshot-manifest.json`
  when available
- `reports/github/feed-submissions/issue-${{ github.event.issue.number }}/feed-submission-validation-summary.json`
  when available
- `data/feeds.yaml`
- `data/feeds.schema.json`
- `data/topics.yaml`
- `.github/labels.yml`

## Decision Policy

1. Prefer the deterministic validator artifacts over re-parsing issue text when those
   artifacts are present.
1. Treat the validator snapshot as `fresh-snapshot` only when it clearly reflects the
   latest issue edit for this run. If the snapshot is stale or missing, use
   `stale-snapshot` or `missing-artifact` and avoid strong approval language.
1. Use validator vocabulary exactly: `validated`, `validation-failed`, `needs-info`,
   `duplicate`, `fresh-snapshot`, `stale-snapshot`, `missing-artifact`, `noop`.
1. If the issue is not clearly a feed submission, return a brief `noop` comment.
1. If required submission data is missing or ambiguous, explain exactly what is missing
   and recommend `status/needs-info` plus `validation-failed`.
1. If the submission conflicts with an existing feed by normalized URL, title, or
   obvious overlap, explain the conflict and recommend `duplicate`.
1. If the submission is coherent and appears consistent with the minimal source schema
   and topic taxonomy, summarize it cleanly and recommend `validated`, `component/data`,
   and `component/schema`.
1. Never infer repository mutation authority from this workflow. Maintainers still
   decide whether any validated snapshot becomes a PR or catalog change.

## Response Requirements

- Keep the comment concise and operational.
- Start with `Snapshot Status` and name `fresh-snapshot`, `stale-snapshot`, or
  `missing-artifact`.
- Start `Verdict` with one of `validated`, `validation-failed`, `needs-info`,
  `duplicate`, or `noop`.
- Include a normalized summary of the feed submission.
- Separate missing-information problems from duplicate concerns.
- Recommend labels only from `.github/labels.yml`.
- End with one maintainer-focused next step.
