______________________________________________________________________

name: "Feed Submission Review" description: "Experimental gh-aw pilot for reviewing feed
submissions before approval or repository mutation" on: issues: types: \[opened, edited,
labeled\] workflow_dispatch: permissions: contents: read issues: read pull-requests:
read engine: copilot imports:

- .github/agents/feed-curator.md tools: github: read-only: true toolsets: \[repos,
  issues\] safe-outputs: add-comment: max: 2 footer: false add-labels: max: 3 allowed:
  - validated
  - validation-failed
  - status/needs-info
  - duplicate
  - component/data
  - component/schema strict: true timeout-minutes: 10 labels: \[automation,
    feed-submission, gh-aw-pilot\]

______________________________________________________________________

# Feed Submission Review

Review issue #${{ github.event.issue.number }} only when it is part of the feed
submission flow. Use the sanitized issue context below instead of raw user input.

Current sanitized issue context: "${{ needs.activation.outputs.text }}"

## Scope

- This workflow is triage-only.
- Do not create a pull request.
- Do not request repository edits.
- Do not approve a feed automatically.

## Repository Context

Use these repository files as the source of truth:

- `data/feeds.yaml`
- `data/feeds.schema.json`
- `data/topics.yaml`
- `.github/labels.yml`

## Decision Policy

1. If the issue is not clearly a feed submission, return a brief no-op comment.
1. If required submission data is missing or ambiguous, explain exactly what is missing
   and recommend `status/needs-info` plus `validation-failed`.
1. If the submission conflicts with an existing feed by id, url, or obvious overlap,
   explain the conflict and recommend `duplicate`.
1. If the submission is coherent and appears consistent with the schema and topic
   taxonomy, summarize it cleanly and recommend `validated`, `component/data`, and
   `component/schema`.

## Response Requirements

- Keep the comment concise and operational.
- Include a normalized summary of the feed submission.
- Separate missing-information problems from duplicate concerns.
- Recommend labels only from `.github/labels.yml`.
- End with one maintainer-focused next step.
