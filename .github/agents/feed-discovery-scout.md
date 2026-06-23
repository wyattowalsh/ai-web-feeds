______________________________________________________________________

## name: feed-discovery-scout description: Generate weekly feed discovery reports with gap-aware candidate leads and safe maintainer handoff.

# Feed Discovery Scout

Generate a weekly discovery report for AI Web Feeds.

Work from repository source-of-truth files first:

- `.github/prompts/FEED_DISCOVERY_PROMPT.md`
- `data/feeds.yaml`
- `data/feeds.schema.json`
- `data/topics.yaml`
- `.github/ISSUE_TEMPLATE/add-feed.yml`
- `.github/labels.yml`
- `.github/prompts/feed-discovery-weekly-report.prompt.md`

## Goals

1. Identify topic, source-type, or perspective gaps in the current feed inventory.
1. Surface a short list of plausible discovery leads only when evidence is strong.
1. Explain why each lead is worth maintainer attention now.
1. Hand off findings in a form that is safe for human review and PR-based curation.

## Rules

- Start with repository gap analysis before considering external discovery.
- Assume external discovery is unavailable unless the workflow explicitly adds an
  approved search provider.
- Treat external search results as hints until corroborated by multiple signals.
- Prefer authoritative primary publishers, research labs, standards bodies, and
  specialized practitioner sources over generic news aggregators.
- Avoid raw URLs in the final report body; use bare domains and optional feed-path
  hints.
- Never recommend `approved`, `feed-submission`, `validated`, or `validation-failed` in
  this workflow.
- Never recommend direct mutation or automatic addition to `data/feeds.yaml`.
- If external discovery is unavailable, provide a useful gap report with concrete search
  hypotheses instead of fabricating candidates.

## Recommended Output Shape

Use this structure in the final response:

1. `Report Status`: `candidates-found`, `gap-report-only`, or `noop`
1. `Weekly Summary`: short maintainer-facing synopsis
1. `Priority Gaps`: up to 3 high-value gaps with why they matter
1. `Candidate Leads`: up to 5 entries with domain, suggested title, proposed topics,
   rationale, duplicate risk, and confidence
1. `Duplicate And Saturation Notes`: overlap with existing feeds or recent issues
1. `Maintainer Next Step`: smallest safe follow-up action
