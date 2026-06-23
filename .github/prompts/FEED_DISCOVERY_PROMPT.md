# Feed Discovery Prompt

Canonical discovery instructions for weekly feed gap analysis. Used by
`.github/prompts/feed-discovery-weekly-report.prompt.md`,
`.github/agents/feed-discovery-scout.md`, and
`.github/workflows/feed-discovery-report.md`.

## Objective

Produce a small, reviewable discovery report that helps maintainers decide where to
expand `data/feeds.yaml` next without mutating repository data directly.

Report-only discovery — not automatic feed acceptance.

## Required repository inputs

Read before producing a report:

- `data/feeds.yaml`
- `data/feeds.schema.json`
- `data/topics.yaml`
- `.github/ISSUE_TEMPLATE/add-feed.yml`
- `.github/labels.yml`
- `.github/workflows/process-feeds.yml`
- `.github/workflows/validate-feed-submission.yml`
- `.github/workflows/add-approved-feed.yml`

## Operating constraints

1. Start with repository-internal gap analysis.
1. Assume external discovery is unavailable unless an approved search provider is
   explicitly configured in the workflow.
1. Cap external discovery leads at 5.
1. Prefer no report over speculative or repetitive noise.
1. Do not rely on the previous issue-label approval flow for discovered candidates.
1. Do not recommend `approved`, `feed-submission`, `validated`, or `validation-failed`.
1. Keep the final report at domain level with optional feed-path hints instead of raw
   URLs.

## Candidate scoring rubric

Score each candidate on a 0–3 scale:

1. **Topic fit** — addresses a clear gap in `topics.yaml` coverage
1. **Authority** — primary source, recognized publisher, or strong specialist signal
1. **Freshness** — recent publishing activity or evidence of ongoing maintenance
1. **Uniqueness** — adds perspective not already saturated in `data/feeds.yaml`

Only include candidates with a convincing overall case. Weak evidence belongs in
**Priority Gaps** or **Duplicate And Saturation Notes**.

## Output shape

Use this section order:

### Weekly Summary

### Priority Gaps (up to 3)

### Candidate Leads

For each lead: Domain, Suggested Title, Proposed Topics, Why It Matters, Duplicate Risk,
Confidence, Maintainer Verification Step.

### Duplicate And Saturation Notes

### Maintainer Next Step

## Quality bar

- Keep the report concise and operational.
- Make uncertainty explicit.
- Prefer better leads over more leads.
- Use repository taxonomy ids exactly as written.
- Do not invent feeds, titles, or topics.
