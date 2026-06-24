# Gap Matrix (SSOT)

## Baseline → Target

| Metric | Baseline | Post-Wave-0 | Target (G4) |
|--------|----------|-------------|-------------|
| Sources | 262 | 319 | 342–382 |
| Orphan topics | 22 | 22 | ≤6 |
| Podcasts | 3 | — | ≥15 |
| Newsletters | 5 | — | ≥18 |
| Forums | 0 | — | ≥8 |
| Docs | 0 | — | ≥6 |
| HTTP-verified candidates | 0 | **63** | 80–120 integrated |

## Gate status

- [x] G0 scouts (T00–T03)
- [x] G0 HTTP audit (T20–T30)
- [x] G0 candidate pool (63 verified; backlog fills to 80+)
- [ ] G1 refine PR (HTTP fixes)
- [ ] G2 builder shards approved
- [ ] G3 integration PRs
- [ ] G4 ship

## HTTP audit (deduped by id)

- Unique sources: **262**
- Failures: **217**
- Success rate: **17.2%**

### Failure classes (Wave 1)

- HTTP 403/404: 46
- Parse errors (HTTP 200): 147
- No entries: 16
- DNS/network: 8
- `Feed parse error: <unknown>:2:…` (51)
- `Feed parse error: <unknown>:20…` (26)
- `HTTP 404…` (24)
- `HTTP 403…` (22)
- `No entries found in feed…` (16)

## Saturation Research Passes (2026-06-24)

3 passes executed (discovery only; candidates/ only). HTTP verified viable feeds (200 + parseable entries or title):

- pass1: 10 viable (AI news, podcasts e.g. TWIML, research blogs)
- pass2: 5 viable (podcasts e.g. Cognitive Revolution, newsletters, infra blogs)
- pass3: 6 viable (policy e.g. Euractiv, research labs, explainers e.g. Jay Alammar, SciDaily)
- total new viable candidates: 21
- stop_rule_met: false (no 3 passes with <5 each; all >=5)

Appended candidate yamls under specs/003-feed-collection-enhancement/candidates/saturation-pass-*.yaml (not integrated to feeds.yaml).

## Saturation Research Passes 4-6 (2026-06-24 continuation)

Completed final 3 passes to meet stop rule (discovery only; written to candidates/ only; all HTTP-verified via validate_feed_url):

- pass4: 3 viable (labs: Google DeepMind, NVIDIA Blog; researcher: Andrej Karpathy)
- pass5: 2 viable (newsletters: Gradient Flow, AI Weekly)
- pass6: 2 viable (deep research: Gwern; consumer coverage: The Verge AI)
- total additional viable: 7
- stop_rule_met: true (passes 4-6 each added <5 HTTP-viable feeds)

Appended saturation-pass-4.yaml, -5.yaml, -6.yaml and updated saturation-passes.json.
