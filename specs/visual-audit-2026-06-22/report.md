# Visual Audit Report — W3 (Report-Only)

**Production:** https://aiwebfeeds.vercel.app\
**Audit dir:** `specs/visual-audit-2026-06-22/`\
**Mode:** Report-only — no code changes\
**Audited:** 2026-06-22

______________________________________________________________________

## Executive Summary

Live production is **moderately healthy** (overall health score **6.6/10**) with all
core hub routes returning 200. However, several high-impact issues block expected user
flows:

- **Critical (P0):** Article deep links 404 on production; keyboard shortcuts (`?`)
  advertised but non-functional on reader.
- **High (P1):** Broken topic→reader handoff (Read topic → /docs); missing site footer
  across surfaces; blog dark mode completely broken; docs sidebar crushes mobile
  content; nav active state wrong on home.
- **Medium (P2):** Reader empty state exposes filter controls with no corpus;
  search→reader handoff styling and per-result actions are weak; docs chrome diverges
  from hub; multiple mobile affordance gaps.
- **Low (P3) / Nit:** Polish, typography, and micro-layout issues.

| Metric                   | Value                                                                          |
| ------------------------ | ------------------------------------------------------------------------------ |
| Overall health score     | **6.6**                                                                        |
| Routes probed (distinct) | ~12 (/, /reader\*, /topics\*, /search, /blog\*, /docs\*, /dashboard, /for-you) |
| Live screenshots         | **95**                                                                         |
| Findings (deduped)       | ~35 unique issues                                                              |
| Critical (P0)            | 2                                                                              |
| High (P1)                | 7                                                                              |
| Medium (P2)              | 16                                                                             |
| Low (P3)                 | 12                                                                             |
| Nit                      | 2                                                                              |
| Quick wins (effort S)    | ~18                                                                            |
| Structural (effort M)    | ~6                                                                             |

**Primary blockers:** Corpus-empty default state, missing article route, broken
discovery→reader handoff, and theme parity gaps (blog).

______________________________________________________________________

## Severity Heatmap (by surface)

```
Surface          │ crit │ high │ med │ low │ nit │  Health
─────────────────┼──────┼──────┼─────┼─────┼─────┼────────
hub              │  0   │  2   │  3  │  4  │  0  │   7.0
reader           │  2   │  1   │  4  │  0  │  0  │   5.5
discovery        │  0   │  3   │  2  │  2  │  1  │   7.6
personal         │  0   │  0   │  1  │  2  │  0  │   5.0
docs             │  0   │  1   │  3  │  0  │  1  │   6.0
content (blog)   │  0   │  1   │  2  │  2  │  0  │   7.5
flows (W2)       │  0   │  1   │  3  │  2  │  0  │   6.0
─────────────────┼──────┼──────┼─────┼─────┼─────┼────────
TOTAL            │  2   │  7   │ 16  │ 12  │  2  │   6.6
```

> Health per surface is taken from the originating task JSON. Overall is a simple
> average across W0–W2 tasks.

______________________________________________________________________

## Top 10 Findings by Impact

| Rank | Severity | Title                                                            | Effort | Surface |
| ---- | -------- | ---------------------------------------------------------------- | ------ | ------- |
| 1    | critical | Article deep link returns 404 on production                      | M      | reader  |
| 2    | critical | Pressing '?' does not open keyboard shortcuts sheet              | S      | reader  |
| 3    | high     | Topics 'Read topic' on /topics/agents leads to /docs             | S      | topics  |
| 4    | high     | No site footer present                                           | M      | hub     |
| 5    | high     | Dark mode does not apply to blog surfaces; content remains light | M      | content |
| 6    | high     | Docs sidebar too wide on mobile (331px on 390px)                 | M      | docs    |
| 7    | high     | Topic cards lack per-card 'Open in reader' quick actions         | S      | topics  |
| 8    | high     | Topic detail source cards have no reader handoff                 | S      | topics  |
| 9    | high     | Nav active state incorrect on home route                         | S      | hub     |
| 10   | high     | Load live sample click has inconsistent navigation outcome       | S      | reader  |

______________________________________________________________________

## P0 / P1 / P2 / P3 Tables

### P0 — Critical

| #   | Title                                               | Surface | Effort | Recommendation                                                                                               |
| --- | --------------------------------------------------- | ------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| 1   | Article deep link returns 404 on production         | reader  | M      | Restore article route or graceful fallback; avoid hard 404 for ephemeral slugs.                              |
| 2   | Pressing '?' does not open keyboard shortcuts sheet | reader  | S      | Mount useReaderShortcutHandlers for empty/loaded states; ensure listReaderShortcuts + Sheet path is reached. |

### P1 — High

| #   | Title                                                | Surface | Effort | Recommendation                                                                 |
| --- | ---------------------------------------------------- | ------- | ------ | ------------------------------------------------------------------------------ |
| 1   | Topics 'Read topic' leads to /docs instead of reader | topics  | S      | Point to /reader?topics=agents (or equivalent); match search handoff pattern.  |
| 2   | No site footer present                               | hub     | M      | Add shared footer with copyright + secondary links across all routes.          |
| 3   | Dark mode does not apply to blog surfaces            | content | M      | Consume theme-manager tokens / Tailwind dark: variants on blog pages.          |
| 4   | Docs sidebar too wide on mobile, crowding content    | docs    | M      | Use mobile drawer/overlay; hide on \<768px; provide hamburger.                 |
| 5   | Topic cards lack per-card 'Open in reader'           | topics  | S      | Add secondary 'Open in reader' affordance on cards linking to filtered reader. |
| 6   | Topic detail source cards have no reader handoff     | topics  | S      | Add 'Open in reader' per source card to /reader?feed=<id>.                     |
| 7   | Nav active state incorrect on home route             | hub     | S      | Home active on exactly '/'; Reader active on /reader\*.                        |
| 8   | Load live sample has inconsistent nav outcome        | reader  | S      | Keep refreshLatest(true) strictly in-place; no router.push out of reader.      |

### P2 — Medium

| #   | Title                                                                      | Surface    | Effort |
| --- | -------------------------------------------------------------------------- | ---------- | ------ |
| 1   | Command palette discovery relies on button hint only                       | hub        | S      |
| 2   | Mobile nav 'Toggle Menu' has no clear open state affordance                | hub/mobile | S      |
| 3   | Onboarding card overlays primary CTA on first visit                        | hub        | M      |
| 4   | Corpus empty state renders filter controls (no guard)                      | reader     | S      |
| 5   | Dark mode shortcuts sheet contrast cannot be verified (sheet not rendered) | reader     | S      |
| 6   | Mobile filter details tap targets require visual verification              | reader     | S      |
| 7   | ArticleTeaser 'Open' targets article page, not reader                      | search     | S      |
| 8   | Search 'Continue in reader' CTA styled identically to Search button        | search     | S      |
| 9   | Docs nav 'Docs' link lacks active state indicator                          | docs       | S      |
| 10  | Docs page uses sidebar chrome breaking top-nav parity                      | docs       | M      |
| 11  | Docs index content is thin; long vertical whitespace                       | docs       | S      |
| 12  | Mobile menu click fails (strict mode, duplicate link roles)                | mobile     | S      |
| 13  | Home nav link click from blog post page does not navigate                  | blog       | S      |
| 14  | 'Updates' label has low contrast on blog index header card                 | content    | S      |
| 15  | Post page immersive variant removes full hub chrome                        | content    | S      |
| 16  | Dashboard lacks site footer consistent with hub                            | dashboard  | M      |

### P3 — Low / Nit

| Severity | Title                                                          | Surface   | Effort |
| -------- | -------------------------------------------------------------- | --------- | ------ |
| low      | Search page empty state lacks visual affordance for input      | search    | S      |
| low      | Hub nav includes many secondary links with no visual grouping  | hub       | M      |
| low      | Mobile topic pills numerous (wall of tags)                     | hub       | S      |
| low      | Topics index flat list rows on mobile; no card treatment       | topics    | S      |
| low      | All topic cards have uniform visual weight regardless of count | topics    | M      |
| low      | For You intentionally empty when BACKEND_URL not configured    | for-you   | S      |
| low      | Metric grid on dashboard stacks compactly on mobile            | dashboard | S      |
| low      | Mobile post header minimal, differs from hub patterns          | content   | S      |
| low      | No RSS/Atom/JSON feed discovery links on post pages            | content   | S      |
| low      | Mobile menu 'Toggle Menu' lacks strong visual affordance       | mobile    | S      |
| low      | Hero uses moderate scale; subhead lengthy                      | hub       | S      |
| low      | Some journeys rely on direct /goto rather than pure UI clicks  | flows     | S      |
| nit      | Search input and button have tight padding on mobile           | search    | S      |
| nit      | Mobile header + sidebar affordance density on narrow docs      | docs      | S      |

______________________________________________________________________

## Per-Surface Summaries

### Hub (`/`, `/search`)

- **Active state bug:** Home shows Reader as active.
- **Footer missing:** No site termination chrome.
- **Onboarding:** Card competes with hero CTAs.
- **Cmd+K:** Functional but poorly discovered.
- **Mobile nav:** Toggle Menu chevron lacks clear state.
- **Search empty:** No pre-focus or example chips; immediate negative empty message.
- **Nav bloat:** Many secondary links inline with no grouping.

**Health:** 7.0

### Reader (`/reader*`)

- **Critical:** Article deep links 404; `?` shortcut does nothing.
- **High:** "Load live sample" sometimes navigates away to /search.
- **Medium:** Empty state shows filter controls (search, source type, topic) with no
  corpus; filters appear interactive but inert.
- **Blocked:** Shortcuts sheet contrast in dark cannot be verified (sheet never
  renders).

**Health:** 5.5 (lowest surface)

### Discovery (`/topics*`, `/search`)

- **High:** No per-card "Open in reader" on topic/source cards; detail page only has
  header "Read topic".
- **High:** "Read topic" CTA from /topics/agents → /docs (wrong destination).
- **Medium:** ArticleTeaser "Open" → article page, not reader; "Continue in reader"
  styling blends with Search button.
- **Low/Nit:** Mobile topic list is flat; uniform card weight regardless of count; tight
  mobile search padding.

**Health:** 7.6

### Personal (`/for-you`, `/dashboard`)

- **/for-you:** Intentionally gated behind BACKEND_URL; shows explanatory message. Not a
  bug per deployment model.
- **Dashboard:** Missing footer (parity issue); metric grid stacks densely on mobile.

**Health:** 5.0

### Docs (`/docs*`)

- **High:** Sidebar ~331px on 390px viewport; crushes content.
- **Medium:** "Docs" nav item never gets active state; docs layout uses distinct sidebar
  chrome breaking hub parity; index is thin (link list + headings).
- **Positive:** ⌘K toggle present; dark theme applies without breakage on docs surfaces.

**Health:** 6.0

### Content / Blog (`/blog*`)

- **High:** Dark mode does not apply; content stays light beige/white.
- **Medium:** Immersive post layout removes hub chrome; "Updates" label low contrast.
- **Low:** Mobile post header minimal; no RSS discovery links on individual posts.
- **Positive:** RSS feed works on index; typography clear; constrained reading width
  intentional.

**Health:** 7.5

______________________________________________________________________

## W2 Journey Results (J1–J7)

| Journey | Name                               | Status  | Notes                                                                          |
| ------- | ---------------------------------- | ------- | ------------------------------------------------------------------------------ |
| J1      | Home → Reader (CTA/nav)            | pass    | Home CTA to /reader works.                                                     |
| J2      | Topics/agents → reader handoff     | partial | "Read topic" → /docs, not reader. Major discovery flow broken.                 |
| J3      | Search q=agent → reader            | pass    | "Continue in reader" reaches /reader?q=agent.                                  |
| J4      | Home nav → /docs chrome parity     | pass    | Route works; docs chrome differs (sidebar).                                    |
| J5      | Dark → /reader theme persists      | pass    | `dark` class persists; theme state maintained.                                 |
| J6      | Mobile 390x844 menu through routes | partial | Menu opens; duplicate link roles cause click targeting failures (strict mode). |
| J7      | /blog → post → back/hub nav        | partial | Post and back-to-blog work; Home nav link from post does not navigate.         |

______________________________________________________________________

## Blocked / Env Notes

- **/for-you:** Requires `BACKEND_URL`; shows intent message and links to sources/docs.
  Personalization surface not exercisable without backend.
- **Article deep links:** `/reader/article/*` returns 404. Deep link contract documented
  but not implemented or corpus missing.
- **Corpus empty default:** `/reader` (and variants) render empty until "Load live
  sample". Filter chrome is visible in empty state; behavior differs from Wave-11
  expectations.
- **Shortcuts sheet:** `?` handler does not surface sheet on prod;
  `listReaderShortcuts()` path not reached.
- **Blog dark:** Blog surfaces do not consume theme tokens; only hub chrome darkens.

______________________________________________________________________

## Screenshot Index

| Folder       | Count  | Notes                                                                 |
| ------------ | ------ | --------------------------------------------------------------------- |
| W0-scout     | 3      | Baseline hub + reader routes                                          |
| W1-hub       | 16     | Home + search (desktop/mobile, light/dark, states)                    |
| W1-reader    | 20     | /reader, query variants, live-sample, article-404, shortcuts attempts |
| W1-discovery | 12     | /topics, /topics/agents, /search (q and baseline)                     |
| W1-personal  | 4      | /for-you, /dashboard (desktop/mobile)                                 |
| W1-docs      | 6      | /docs, /docs/development/cli (desktop/mobile, light/dark)             |
| W1-content   | 9      | /blog, /blog/hub-and-blog (desktop/mobile, light/dark attempts)       |
| W2-flows     | 25     | J0–J7 journey captures across viewports/themes                        |
| **Total**    | **95** | All PNG                                                               |

**Naming pattern:** `{route-slug}__{viewport}__{theme}__{state}.png`

______________________________________________________________________

## Recommended Fix Waves

### Quick-Win (≤1 day each, high leverage)

- Fix nav active state on `/` (Home vs Reader) — S
- Point "Read topic" to `/reader?topics=...` — S
- Add per-card "Open in reader" affordances on topic/source cards — S
- Add per-result "Read in reader" on ArticleTeaser — S
- Differentiate "Continue in reader" CTA styling — S
- Auto-focus search input + example chips on /search empty — S
- Wire `?` shortcuts sheet end-to-end — S
- Add footer component (shared) — M (but scoped)
- Fix blog dark mode token consumption — M
- Make "Load live sample" strictly in-place — S
- Ensure Home nav works from blog post pages — S
- Mobile menu: unique ARIA names / hide duplicates; add backdrop + X — S
- Docs: wire `data-active` for /docs\* subtree — S

### Polish-Wave-12 (structural polish)

- Mobile docs sidebar → drawer/overlay; responsive rules — M
- Unify docs chrome with hub top nav (sidebar as addition) — M
- Add shared footer across hub surfaces — M
- Reader empty: guard/disable filters until corpus present — S
- Onboarding: reduce intrusiveness (sidebar/collapsible) — M
- Hero polish (scale + subhead length) — S
- Blog post header parity with hub (keep top nav in immersive) — S
- Dashboard footer + metric density tweaks — M

### Polish-Wave-13 (editorial / fine)

- Topic card visual weight by count (optional) — M
- Mobile topic pills: collapse or "More" — S
- RSS discovery on blog post pages — S
- Mobile post header minimalism alignment or docs — S
- Cmd+K discoverability hint (persistent or onboarding) — S
- Search empty message softening — S
- Journey test coverage: pure UI paths (⌘K, form fill) — S

### Bugfix / Feature Waves (non-polish)

- Restore article deep link route or add graceful fallback — M (fix-wave-12)
- Ensure shortcuts sheet mounts regardless of corpus state — S (fix-wave-12)
- Consider hiding "For You" nav when BACKEND_URL absent — S (docs-wave)

______________________________________________________________________

## Out of Scope (Report-Only)

- Backend corpus generation / SQLite population on Vercel
- New feed sources or enrichment pipeline
- Performance profiling (LCP/INP)
- Auth/admin flows beyond surface 200 checks
- Mobile native / PWA install funnel
- Code changes — report only

______________________________________________________________________

## Appendix: Reference Prior Style

This report follows the structure and tone of `specs/reader-ui-audit-wave11/plan.md`
(executive summary, heatmap, top-N table, P0–P3 tables, per-surface notes, journey
table, blocked notes, screenshot index, and wave recommendations) adapted for a
report-only synthesis across W0–W2 artifacts.

**Generated:** 2026-06-22 — W3-report synthesizer. No files were modified outside
`specs/visual-audit-2026-06-22/`.
