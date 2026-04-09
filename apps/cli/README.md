# ai-web-feeds CLI

Typer-based command-line interface for the `ai-web-feeds` repository.

- Preferred command: `ai-web-feeds`
- Compatibility alias: `aiwebfeeds`

## Install

```bash
uv sync
```

## Smoke test

```bash
uv run ai-web-feeds --help
uv run ai-web-feeds process --help
```

## Primary command groups

| Command     | Purpose                                                                   |
| ----------- | ------------------------------------------------------------------------- |
| `process`   | End-to-end feed processing pipeline                                       |
| `load`      | Load authored feed YAML into the runtime database                         |
| `validate`  | Validate feed documents, topics, references, URLs, and stored HTTP health |
| `enrich`    | Enrich feed metadata and write derived YAML output                        |
| `export`    | Export authored catalogs as JSON and OPML                                 |
| `opml`      | Generate reader-oriented OPML from stored feed sources                    |
| `stats`     | Show runtime database statistics                                          |
| `test`      | Run repository pytest suites through the CLI wrapper                      |
| `analytics` | Query analytics summaries, snapshots, and CSV exports                     |
| `search`    | Initialize search tables, query feeds, and manage saved searches          |
| `recommend` | Generate and track recommendations                                        |
| `monitor`   | Run monitoring, follows, and digest workflows                             |
| `visualize` | Render topic taxonomy outputs from `data/topics.yaml`                     |
| `nlp`       | Run NLP maintenance commands and job statistics                           |

## Quick examples

```bash
uv run ai-web-feeds load from-yaml --input data/feeds.yaml --clear
uv run ai-web-feeds validate all --strict
uv run ai-web-feeds enrich all --input data/feeds.yaml --output data/feeds.enriched.yaml
uv run ai-web-feeds export all --input data/feeds.enriched.yaml --output-dir data
uv run ai-web-feeds stats show --format json
uv run ai-web-feeds nlp stats --database sqlite:///data/ai-web-feeds.db
uv run ai-web-feeds visualize stats --input data/topics.yaml
```

## Runtime defaults

- Database environment variable: `AIWF_DATABASE_URL`
- Canonical SQLite path: `data/ai-web-feeds.db`
- Legacy SQLite path accepted for compatibility: `data/aiwebfeeds.db`
- Canonical authored inputs: `data/feeds.yaml`, `data/topics.yaml`

Most commands that operate on the runtime database use `--database` to override
`AIWF_DATABASE_URL`.

## Documentation

- Web docs: `apps/web/content/docs/development/cli.mdx`
- Workflow examples: `apps/web/content/docs/development/cli-workflows.mdx`
