# Goal: Comprehensive AI Feed Catalog

Collect every relevant AI-related web feed, validate them strictly (schema + HTTP), and ensure 100% enrichment parity — continuing and completing the in-flight `specs/003-feed-collection-enhancement/` work with unbounded saturation discovery until diminishing returns.

## Shared understanding

See [facts.md](./facts.md) for the 14 accepted facts governing scope, policies, and done gates.

## Execution plan

See [plan.md](./plan.md) for the massively parallel 5-wave DAG (W0–W4), hyperfine task graph (T00–T98), gate definitions (G0–G4), and verification commands.

## Done condition

The goal is complete when **Gate G4** passes:

- `uv run ai-web-feeds validate all` — green
- `uv run ai-web-feeds validate http` — 0 failures
- `feeds.enriched.yaml` count and IDs match `feeds.yaml` 1:1
- Orphan topics ≤6
- `data/validate_data_assets.py` — 30/30
- pytest coverage ≥90%, no regressions
- No `verified` flags in `feeds.yaml`
- Discovery saturation stop rule met (3 passes <5 viable feeds each)