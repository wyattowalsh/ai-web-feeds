# Facts

- Execution continues and completes the in-flight spec 003 feed-collection-enhancement work (orchestration artifacts, candidate shards, gates G1–G4) rather than starting a parallel catalog effort.
- Discovery covers all major AI-relevant categories: media (podcasts/newsletters/video), practitioner blogs, forums & docs changelogs, research feeds, org/lab announcements, non-US/multilingual sources, and social/aggregator proxies (Reddit, HN, Twitter/X).
- There is no hard source-count ceiling; discovery continues until category saturation (gap-matrix and orphan-matrix show diminishing returns), with a minimum of integrating spec 003's verified candidate pool and fully processing the existing catalog.
- Broken or unreachable feeds are fixed (URL replacement, feed discovery) or removed; the done gate requires zero HTTP validation failures.
- Every source in feeds.yaml has a matching enriched entry with required fields (id, title, source_type, topics), resolved feed URL, auto tags where detectable, and health/quality/completeness scores.
- feeds.enriched.yaml source count equals feeds.yaml source count (1:1 parity).
- SQLite sources table (ai-web-feeds.db) is synced 1:1 with the final catalog.
- No verified or curation-status flags are authored in feeds.yaml; trusted-by-policy catalog only.
- All derivative assets are regenerated: feeds.enriched.yaml, OPML exports, feeds.json, and SQLite cache.
- ai-web-feeds validate all passes with no schema or reference errors.
- data/validate_data_assets.py reports 30/30 checks passing.
- Orphan topics (zero assigned sources) are reduced to ≤6 via honest retagging and new source assignment.
- Test suite maintains ≥90% coverage with no regressions introduced by catalog changes.
- Out of scope: real-time monitoring, web UI changes, new CLI commands, and ongoing scheduled auto-discovery.