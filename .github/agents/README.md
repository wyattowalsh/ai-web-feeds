# Repository Agents

Reusable repository-owned custom agents live in this directory.

## Index

| Agent                  | Description                                                                                           | Notes                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `catalog-steward`      | Interprets deterministic catalog intelligence and validation artifacts for source-only gh-aw reports. | Shared agent for weekly intelligence and PR digest pilots. |
| `feed-curator`         | Reviews feed submission issues against repository data and schema rules.                              | Initial gh-aw pilot support agent.                         |
| `feed-discovery-scout` | Produces weekly feed discovery reports with gap-aware candidate leads.                                | Report-only discovery pilot support agent.                 |

## Agents

### `catalog-steward`

Use this agent when a workflow needs to reason from deterministic catalog or feed
submission artifacts without becoming a mutation authority.

### `feed-curator`

Use this agent when reviewing or normalizing feed submission issues. It is scoped to
repository data quality and maintainer triage, not repository mutation.

### `feed-discovery-scout`

Use this agent when preparing a weekly or manual discovery report. It is scoped to gap
analysis, candidate lead triage, and safe handoff for maintainer review.
