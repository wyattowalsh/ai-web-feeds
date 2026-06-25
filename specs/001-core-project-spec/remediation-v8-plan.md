# Remediation v8 — RV + Postgres + Auth + Instrumentation (~258 nodes)

Supersedes **v7** (210 nodes). Adds **Track C** (instrumentation + future-forward
models) and resolves v7 deferrals (`search/log` → Neon `SearchQuery`, not 501).

**Observability default (no user choice recorded):** Postgres-first product analytics
(`usage_events`, `api_request_logs`, wired
`SearchQuery`/`SyncEvent`/`RecommendationInteraction`)

- retain NDJSON telemetry; **optional Logfire** when `LOGFIRE_TOKEN` is set on Python
  paths.

______________________________________________________________________

## Scope summary

| Track     | Nodes | Delivers                                                                               |
| --------- | ----- | -------------------------------------------------------------------------------------- |
| **A**     | 123   | RV-1..RV-13, Neon catalog mirror, staged `catalog_sync`, viz SQL fixes                 |
| **B**     | 87    | Better Auth (OAuth/magic/email), direct Neon user APIs, saved filters, merge           |
| **C**     | 40    | Dual-write telemetry, client `trackEvent`, Python optional Logfire, migrations 008–010 |
| **Final** | 8     | Merge, G12 gate                                                                        |

**G12 = A-G6 ∧ B-G10 ∧ C-G12**

______________________________________________________________________

## Architecture (unchanged)

- **Git SSOT:** `data/feeds.yaml`, `data/topics.yaml`
- **Neon SSOT:** catalog mirror, articles, user tables, usage analytics, Better Auth
- **Derived:** `articles.generated.json`, enriched YAML/OPML
- **Client:** IndexedDB offline; server sync when session exists
- **Auth:** Google/GitHub OAuth + magic link + email/password; anonymous UUID fallback

______________________________________________________________________

## Part 1 — v7 critique → v8 fixes

| v7 gap                                                          | v8 resolution                                             |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| No instrumentation track                                        | **Track C** (40 nodes)                                    |
| `B-DEFER-02` search/log 501                                     | **C-TEL-06** Neon `SearchQuery` insert                    |
| NDJSON-only API telemetry                                       | **C-TEL-02** dual-write NDJSON + `api_request_logs`       |
| Unwired `SearchQuery`, `SyncEvent`, `RecommendationInteraction` | C-TEL-06/07/08                                            |
| `UserArticleState` int PK only                                  | Migration 009 `article_key` (stable_id)                   |
| No universal event schema                                       | `usage_events` table + client `trackEvent()`              |
| Python paths uninstrumented                                     | C-PY-01..05 optional Logfire + wide events                |
| Saved filter/search engagement fields missing                   | 010: `use_count`, `pinned`, `is_default`                  |
| Article corpus metadata thin                                    | 010: `content_hash`, `word_count`, `reading_time_minutes` |

______________________________________________________________________

## Part 2 — Backend route tier matrix (v7 + v8)

| Tier              | Routes                                                    | Action                    |
| ----------------- | --------------------------------------------------------- | ------------------------- |
| T1 User storage   | `/storage/*` proxies                                      | Direct Neon (Track B)     |
| T1b User new      | `/api/user/filters`, `/api/user/state`, `/api/user/merge` | New Neon routes           |
| **T1c Analytics** | `/search/log`, `/api/telemetry/events`                    | **Track C** Neon writes   |
| T2 Python exists  | `/analytics/*`, `/nlp/*`, `/recommendations`, viz API     | Keep `fetchBackend`       |
| T3 Missing        | `/storage/digests`                                        | 501 stub until digest job |
| T0 Local          | `/api/articles`, `/api/feeds`, corpus search              | Unchanged                 |

______________________________________________________________________

## Part 3 — TRACK C: Instrumentation (40 nodes)

### C-Wave 0 Contract (6)

| ID       | Task                                                                           |
| -------- | ------------------------------------------------------------------------------ |
| C-C-01   | `UsageEvent` + `EventSurface` enum (`reader`, `search`, `api`, `auth`, `sync`) |
| C-C-02   | `ApiRequestLog` mirrors `ApiTelemetryEvent`                                    |
| C-C-03   | Versioned JSON payload contracts (`usage-event-v1`, `reader-filter-v1`)        |
| C-MIG-01 | Alembic 008: `usage_events`, `api_request_logs`                                |
| C-MIG-02 | Alembic 009/010: `article_key` stable_id + future-forward columns              |
| C-T-01   | Failing tests for event insert + schema                                        |

### C-Wave 1 Server telemetry (10)

| ID       | Task                                                                        |
| -------- | --------------------------------------------------------------------------- |
| C-TEL-01 | `lib/server/telemetry-store.ts` — `recordUsageEvent`, `recordApiRequestLog` |
| C-TEL-02 | Extend `withRouteTelemetry` async Postgres dual-write                       |
| C-TEL-03 | `POST /api/telemetry/events` batch ingest (client events)                   |
| C-TEL-04 | `lib/track-event.ts` client helper (`session_id`, `surface`, `properties`)  |
| C-TEL-05 | Instrument reader hooks (filter apply, article open, star, scroll)          |
| C-TEL-06 | Search route → Neon `search_queries` (replaces B-DEFER-02)                  |
| C-TEL-07 | Recommendation interaction → Neon                                           |
| C-TEL-08 | Sync reconciliation → `sync_events`                                         |
| C-TEL-09 | Admin telemetry summary reads Postgres (fallback NDJSON)                    |
| C-TEL-10 | `usage_events` retention policy doc                                         |

### C-Wave 2 Python observability (8)

| ID      | Task                                                   |
| ------- | ------------------------------------------------------ |
| C-PY-01 | Optional `logfire` extra + `configure_observability()` |
| C-PY-02 | Spans on `catalog_sync` stages                         |
| C-PY-03 | Spans on `process` CLI                                 |
| C-PY-04 | Spans on `DatabaseManager` hot paths                   |
| C-PY-05 | Wide event on `PipelineRun` completion                 |
| C-PY-06 | Env: `LOGFIRE_TOKEN`, `LOGFIRE_SERVICE_NAME`           |
| C-PY-07 | No-op when token absent (CI-safe)                      |
| C-PY-08 | Test observability bootstrap                           |

### C-Wave 3 Quality (6)

| ID       | Task                                                  |
| -------- | ----------------------------------------------------- |
| C-Q-01   | Vitest dual-write telemetry                           |
| C-Q-02   | Vitest SearchQuery neon insert                        |
| C-Q-03   | Pytest usage_events model                             |
| C-Q-04   | `validate_data_assets` optional telemetry row check   |
| C-DOC-01 | `apps/web/content/docs/development/observability.mdx` |
| C-DOC-02 | Update `meta.json` nav                                |

**C-G12:** ≥1 API route + ≥1 client event persisted to Postgres; NDJSON still written.

______________________________________________________________________

## Part 4 — Migration 008/009/010 field contract

### 008 `usage_events`

- `id` UUID PK
- `schema_version` (default `usage-event-v1`)
- `event_name` indexed
- `surface` indexed
- `user_id` nullable indexed
- `session_id` nullable indexed
- `request_id` nullable
- `properties` JSONB
- `occurred_at` timestamptz indexed

### 008 `api_request_logs`

- Mirrors `ApiTelemetryEvent` fields + `ingested_at`

### 009/010 extensions

| Table                  | New columns                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `articles`             | `stable_id`, `content_hash`, `word_count`, `reading_time_minutes`, `language_detected` |
| `sources`              | `catalog_hash`, `last_synced_at`                                                       |
| `saved_searches`       | `use_count`, `pinned`, `is_default`                                                    |
| `saved_reader_filters` | `use_count`, `pinned`, `is_default`, `schema_version`                                  |
| `user_article_states`  | `article_key`, `read_duration_ms`, `scroll_depth`, `opened_from`                       |

Unique: `(user_id, article_key)` alongside legacy `(user_id, article_id)`.

______________________________________________________________________

## Part 5 — TRACK A & B (v7 unchanged)

See v7 node registry (210 tasks). v8 **does not remove** any A/B task. Key gates:

- **A-G6:** `topics≥topics.yaml count`, `sources≥max(496, feeds.yaml count)`,
  `source_topics≥feeds.yaml topic assignments`, `pipeline_runs≥1` (warn-only unless
  `VALIDATE_A_G6_REQUIRE_PIPELINE_RUNS=1`)
- **B-G10:** Auth + saved filters/searches/follows/notifications e2e without
  `BACKEND_URL`

### Execution progress (2026-06-25 parallel wave)

| Track               | Status    | Evidence                                                                                          |
| ------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| A mapper + sync     | **Done**  | `catalog_sync/mapper.py`, `stages.py`, `sync.py`; DB `topics=92`, `sources=496`, `junctions=1514` |
| A viz SQL (RV-2)    | **Done**  | `data_service.py` uses `topic_stats`, `validations`, `article_topics`                             |
| A validate (RV-4/5) | **Done**  | `validate_contributor_feed()`, unified `enrich_feed_source`                                       |
| A stable_id         | **Done**  | `articles.py`, migration `009_article_stable_id`, TS normalize                                    |
| B auth              | **Done**  | email/magic/OAuth, async session identity                                                         |
| B user-store + APIs | **Done**  | T1 routes → Neon; `/api/user/{filters,state,merge}`                                               |
| C telemetry         | **Done**  | `telemetry-store`, dual-write, `/api/telemetry/events`, `search-log`                              |
| C models/mig        | **Done**  | migration `008_usage_events`, `UsageEvent`/`ApiRequestLog`                                        |
| C Python obs        | **Done**  | `observability.py` optional Logfire                                                               |
| QA                  | **Green** | pytest 107+ (unit slice), vitest 364 (full web)                                                   |

### Wave 3 progress (2026-06-25)

| Track              | Status   | Evidence                                                                                                          |
| ------------------ | -------- | ----------------------------------------------------------------------------------------------------------------- |
| A ledger           | **Done** | `pipeline_runs=1`, stage runs + wide event                                                                        |
| A migration 010    | **Done** | Future-forward columns + backfill                                                                                 |
| A CI               | **Done** | Postgres secret path, catalog sync step, no `.db` commit                                                          |
| B UI               | **Done** | `saved-reader-filters.tsx`, hook — 8 tests                                                                        |
| B E2E              | **Done** | `auth-filters.spec.ts` chromium 3/3                                                                               |
| C reader telemetry | **Done** | `use-reader-telemetry.ts` — 9 tests                                                                               |
| C docs             | **Done** | `observability.mdx` + nav                                                                                         |
| A-G6 gates         | **Done** | `validate_data_assets.py` dynamic thresholds from `feeds.yaml`/`topics.yaml`; DB `496/92/1514`, `pipeline_runs=1` |

**validate_data_assets:** 30/30 passed; A-G6 gate green (`topics=92`, `sources=496`,
`source_topics=1514`, `pipeline_runs=1`).

### Wave 4 final (2026-06-25)

| Track                 | Status                                                            |
| --------------------- | ----------------------------------------------------------------- |
| B merge + hydrate     | **Done** — `AccountSessionBootstrap`, login/signup post-auth sync |
| B account + delete    | **Done** — `/account`, `DELETE /api/user/delete`                  |
| B trending Neon       | **Done**                                                          |
| A CLI catalog sync    | **Done** — `process` step 6                                       |
| C-G12 automated proof | **Done** — telemetry route + SQLModel tests                       |
| E2E                   | **Done** — `account-merge.spec.ts` + auth-filters (chromium)      |

**G12 status:** **A-G6 ∧ B-G10 ∧ C-G12 achieved** for local/SQLite CI. Neon production
requires `DATABASE_URL` GitHub secret at deploy.

______________________________________________________________________

## Part 6 — Parallel spawn playbook

| Phase | Spawn (max 10)                      | Gate               |
| ----- | ----------------------------------- | ------------------ |
| P0    | A-SC + B-SC + C scouts              | synthesize         |
| P1    | A-PG, A-C, B-DB, B-C, C-C, C-MIG-01 | A-G0, B-U0, C-W0   |
| P2    | A-M mapper, A-TOP, B-A auth plugins | A-G1 partial       |
| P3    | A-SY sync, B-G8 auth UI             | A-G2, B-G8         |
| P4    | A-VZ, A-MG, B-MIG, B stores, C-TEL  | A-G3, B-G9, C-W1   |
| P5    | A-Q, B-UI, C-PY, C-TEL client       | A-G4, B-G10, C-G12 |
| P6    | A-I CI, W11 merge                   | G12                |

**plan_approval required:** A-MG-*, B-MIG-*, C-MIG-*, B-MG-*, B-A-01..05, A-SY-07

______________________________________________________________________

## Part 7 — Verification

```bash
export DATABASE_URL="postgresql://..."
export BETTER_AUTH_SECRET="..."
uv run ai-web-feeds process --skip-enrichment
uv run python data/validate_data_assets.py
cd apps/web && pnpm vitest run && pnpm exec playwright test tests/e2e/auth-filters.spec.ts
```

**G12 expectations:** A-G6 + B-G10 + Postgres receives `usage_events` and
`search_queries` rows from at least one automated test path.

______________________________________________________________________

## Part 8 — Out of scope

- T2 routes Neon migration
- WebSocket notification delivery
- Email digest generation job
- IndexedDB removal
- Logfire required in CI (optional only)
