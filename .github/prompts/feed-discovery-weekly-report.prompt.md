______________________________________________________________________

## mode: agent

# AI Web Feeds Weekly Discovery Report Prompt

Use this prompt when generating a scheduled or manually-triggered weekly discovery
report for the repository.

______________________________________________________________________

## Objective

Produce a small, reviewable discovery report that helps maintainers decide where to
expand `data/feeds.yaml` next without mutating repository data directly.

This prompt is for report-only discovery, not automatic feed acceptance.

______________________________________________________________________

## Required Repository Inputs

Read these before producing a report:

- `FEED_DISCOVERY_PROMPT.md`
- `data/feeds.yaml`
- `data/feeds.schema.json`
- `data/topics.yaml`
- `.github/ISSUE_TEMPLATE/add-feed.yml`
- `.github/labels.yml`
- `.github/workflows/process-feeds.yml`
- `.github/workflows/validate-feed-submission.yml`
- `.github/workflows/add-approved-feed.yml`

______________________________________________________________________

## Operating Constraints

1. Start with repository-internal gap analysis.
1. Assume external discovery is unavailable unless an approved search provider is
   explicitly configured in the workflow.
1. Cap external discovery leads at 5.
1. Prefer no report over speculative or repetitive noise.
1. Do not rely on the legacy issue-label approval flow for discovered candidates.
1. Do not recommend `approved`, `feed-submission`, `validated`, or
   `validation-failed`.
1. Keep the final report at domain level with optional feed-path hints instead of
   raw URLs.

______________________________________________________________________

## Candidate Scoring Rubric

Score each candidate on a simple 0-3 scale across these dimensions:

1. `Topic Fit`: addresses a clear gap in `topics.yaml` coverage
1. `Authority`: primary source, recognized publisher, or strong specialist signal
1. `Freshness`: recent publishing activity or evidence of ongoing maintenance
1. `Uniqueness`: adds perspective not already saturated in `data/feeds.yaml`

Only include candidates with a convincing overall case. If the evidence is weak,
move the insight into `Priority Gaps` or `Duplicate And Saturation Notes` instead.

______________________________________________________________________

## Output Shape

Use this exact section order:

### Weekly Summary

- What changed, what remains under-covered, and whether external discovery is
   configured for this workflow

### Priority Gaps

- Up to 3 gaps with one sentence each on why they matter now

### Candidate Leads

For each lead include:

- `Domain`
- `Suggested Title`
- `Proposed Topics`
- `Why It Matters`
- `Duplicate Risk`
- `Confidence`
- `Maintainer Verification Step`

If no discovery leads are appropriate, say `External discovery is not configured`
or `No high-confidence leads this run` and explain why.

### Duplicate And Saturation Notes

- Call out recently-covered areas, likely overlaps, or topics that should be
  deprioritized next week

### Maintainer Next Step

- One concrete follow-up, ideally a human-reviewed PR into `data/feeds.yaml`

______________________________________________________________________

## Quality Bar

- Keep the report concise and operational.
- Make uncertainty explicit.
- Prefer better leads over more leads.
- Use repository taxonomy ids exactly as written.
- Do not invent feeds, titles, or topics.