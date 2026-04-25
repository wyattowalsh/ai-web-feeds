______________________________________________________________________

name: "Feed Discovery Report" description: "Experimental gh-aw pilot for weekly feed gap
analysis and report-only discovery leads" on: schedule: - cron: "0 14 * * 1"
workflow_dispatch: permissions: contents: read issues: write engine: copilot imports:

- .github/agents/feed-discovery-scout.md tools: github: read-only: true toolsets:
  [repos, issues] safe-outputs: create-issue: max: 1 title-prefix: "[gh-aw] " labels:
  - automated
  - component/data
  - status/needs-review close-older-issues: true footer: false strict: true network:
    allowed:
  - defaults
  - github timeout-minutes: 12 labels: [automation, discovery, gh-aw-pilot]

______________________________________________________________________

# Feed Discovery Report

Generate at most one maintainer-facing discovery report issue for this run.

## Scope

- This workflow is report-only.
- This workflow is source-only and additive. It must not become the canonical mutation
  path for catalog changes in this pass.
- Do not create a pull request.
- Do not request direct repository mutation.
- Do not recommend or apply labels that trigger feed submission or approval automation.
- Prefer a no-op over low-confidence or repetitive output.

## Repository Context

Use these files as the source of truth before making any recommendation:

- `reports/github/catalog/feed-processing-summary.json` when available
- `data/feeds.yaml`
- `data/feeds.schema.json`
- `data/topics.yaml`
- `.github/ISSUE_TEMPLATE/add-feed.yml`
- `.github/labels.yml`
- `.github/prompts/feed-discovery-weekly-report.prompt.md`
- `.github/workflows/process-feeds.yml`
- `.github/workflows/validate-feed-submission.yml`
- `.github/workflows/add-approved-feed.yml`

## Operating Policy

1. Start with gap analysis inside the repository: identify underrepresented topics,
   duplicate-prone areas, and any recent discovery work already captured in open issues.
1. This pilot is repository-gap-analysis-first. Only use external discovery after a
   maintainer adds an approved search provider to the workflow configuration. Until
   then, produce a gap-only report rather than inventing leads.
1. If you surface candidate leads, cap the list at 5 and prefer authoritative,
   feed-likely publishers over broad aggregators.
1. Because legacy issue-based feed automation still assumes an older submission shape,
   never recommend `approved`, `feed-submission`, `validated`, or `validation-failed` in
   this workflow.
1. Keep candidate references at the domain level with optional feed-path hints. Avoid
   raw URLs in the final issue body.
1. The handoff for any promising lead is a human-reviewed PR into `data/feeds.yaml`,
   followed by the existing deterministic processing workflow.

## Output Requirements

If you create an issue, use this structure:

1. `Report Status`: one of `candidates-found`, `gap-report-only`, or `noop`
1. `Snapshot Status`: one of `fresh-snapshot`, `stale-snapshot`, or `missing-artifact`
1. `Weekly Summary`: what changed or what remains under-covered
1. `Priority Gaps`: up to 3 topic or source-type gaps worth pursuing next
1. `Candidate Leads`: up to 5 domain-level leads, or state clearly that external
   discovery is not configured for this pilot
1. `Duplicate And Saturation Notes`: overlap with existing feeds or recent issues
1. `Maintainer Next Step`: the smallest safe follow-up action

Keep the report concise, operational, and explicit about confidence.
