# Repository Agents

Reusable repository-owned custom agents live in this directory.

## Index

| Agent                  | Description                                                              | Notes                                      |
| ---------------------- | ------------------------------------------------------------------------ | ------------------------------------------ |
| `feed-curator`         | Reviews feed submission issues against repository data and schema rules. | Initial gh-aw pilot support agent.         |
| `feed-discovery-scout` | Produces weekly feed discovery reports with gap-aware candidate leads.   | Report-only discovery pilot support agent. |

## Agents

### `feed-curator`

Use this agent when reviewing or normalizing feed submission issues. It is scoped to
repository data quality and maintainer triage, not repository mutation.

### `feed-discovery-scout`

Use this agent when preparing a weekly or manual discovery report. It is scoped to gap
analysis, candidate lead triage, and safe handoff for maintainer review.
