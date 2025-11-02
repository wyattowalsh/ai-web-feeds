---

description: "Executable task list for Client-Side Power Features"

---

# Tasks: Client-Side Power Features

**Input**: Design documents from `/specs/004-client-side-features/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Constitution mandates test-first delivery. Each user story includes dedicated test tasks.

**Organization**: Tasks are grouped by user story to keep delivery increments independent and testable.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare tooling, dependencies, and scaffolding required across all user stories.

- [ ] T001 Update client dependencies for Dexie.js, onnxruntime-web, Playwright, and Vitest in `apps/web/package.json`
- [ ] T002 Scaffold worker build pipeline in `apps/web/scripts/build-workers.ts`
- [ ] T003 [P] Configure Vitest environment (JSDOM, setup files, coverage) in `apps/web/vitest.config.ts`
- [ ] T004 [P] Configure Playwright projects (Chromium, Firefox, offline context) in `apps/web/playwright.config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core platform capabilities required by every user story (database, messaging, diagnostics).

**⚠️ CRITICAL**: Complete before starting any story phases.

- [ ] T005 Implement shared Dexie database schema (`articles`, `feeds`, `folders`, `views`, `annotations`, `reading_history`, `search_index`, `offline_tasks`, `extension_queue`) in `apps/web/lib/indexeddb/db.ts`
- [ ] T006 Provide React context/provider for Dexie access in `apps/web/lib/indexeddb/provider.tsx`
- [ ] T007 Implement storage quota monitor with 70/80/90 thresholds in `apps/web/lib/storage/quota-monitor.ts`
- [ ] T008 Implement service worker registration and lifecycle helpers in `apps/web/service-worker/registration.ts`
- [ ] T009 [P] Implement worker messaging utilities (BroadcastChannel + postMessage bridge) in `apps/web/lib/workers/channel.ts`
- [ ] T010 Implement local diagnostic log buffer (500 entry ring) in `apps/web/lib/logger/local-log-buffer.ts`

---

## Phase 3: User Story 1 - Offline Feed Reading 📱 (Priority: P1) — 🎯 MVP

**Goal**: Enable users to download feeds for offline reading, preserve local edits, and manage storage limits without backend support.

**Independent Test**: On a fresh profile, subscribe to feeds, click "Save for Offline," toggle airplane mode, and confirm cached articles render with last-sync timestamp, storage warnings, and conflict resolution flow when reconnected.

### Tests (write first, ensure they fail) — COMPLETE BEFORE IMPLEMENTATION

- [ ] T011 [P] [US1] Add Playwright offline reading scenario in `apps/web/tests/e2e/offline-reading.spec.ts`
- [ ] T012 [P] [US1] Add Vitest offline sync + conflict resolution suite in `apps/web/tests/integration/offline-sync.test.ts`

### Implementation (RED-GREEN-REFACTOR: Start after tests fail)

- [ ] T013 [US1] Implement offline caching & background sync queue in `apps/web/service-worker/sw.ts` (Depends: T011, T012)
- [ ] T014 [US1] Implement offline sync manager (save/read/star conflict rules) in `apps/web/lib/indexeddb/offline-sync.ts` (Depends: T012)
- [ ] T015 [US1] Build offline feed view with status badge and timestamp in `apps/web/app/feeds/offline/offline-feed.tsx` (Depends: T011)
- [ ] T016 [US1] Build storage warning + cleanup UI in `apps/web/components/offline/storage-banner.tsx` (Depends: T011)
- [ ] T017 [US1] Build conflict resolution panel in `apps/web/app/offline/conflicts/page.tsx` (Depends: T012)

**Parallel Work Example**: While T013 focuses on Service Worker logic, another developer can implement the UI tasks (T015–T017) once T011/T012 define expectations.

---

## Phase 4: User Story 2 - Advanced Client-Side Search 🔍 (Priority: P2)

**Goal**: Provide sub-50 ms search across IndexedDB articles with filters and relevance ranking, powered entirely by Web Workers.

**Independent Test**: With 1,000+ cached articles, typing queries in `/search` returns highlighted results within performance budget while filters update instantly.

### Tests (write first) — COMPLETE BEFORE IMPLEMENTATION

- [ ] T018 [P] [US2] Add Vitest tokenizer & indexer unit tests in `apps/web/tests/unit/search/tokenize.test.ts`
- [ ] T019 [P] [US2] Add Playwright search filtering performance spec (<50ms threshold) in `apps/web/tests/e2e/search-filters.spec.ts`

### Implementation (RED-GREEN-REFACTOR: Start after tests fail)

- [ ] T020 [US2] Implement `apps/web/workers/search.worker.ts` (index build + query execution) (Depends: T018, T019)
- [ ] T021 [US2] Implement index manager orchestration in `apps/web/lib/search/index-manager.ts` (Depends: T018)
- [ ] T022 [US2] Build advanced search panel with filters in `apps/web/components/search/advanced-search-panel.tsx` (Depends: T019)
- [ ] T023 [US2] Integrate search results page with highlighting + performance metrics (<50ms verification) in `apps/web/app/search/page.tsx` (Depends: T019)

**Parallel Work Example**: T018 and T019 can run concurrently; after the worker (T020) is stubbed, UI tasks (T022–T023) can iterate in parallel with index manager (T021).

---

## Phase 5: User Story 3 - Smart Feed Organization 📂 (Priority: P3)

**Goal**: Allow users to organize feeds into folders, craft custom views, and persist layouts locally.

**Independent Test**: Create folders, drag feeds via UI, define “Today’s Reading” custom view, refresh browser, and confirm state persists and exports/imports cleanly.

### Tests (write first) — COMPLETE BEFORE IMPLEMENTATION

- [ ] T024 [P] [US3] Add Vitest folder & view repository tests in `apps/web/tests/unit/organization/folders.test.ts`
- [ ] T025 [P] [US3] Add Playwright drag-drop + view persistence test in `apps/web/tests/e2e/organization-folders.spec.ts`

### Implementation (Depends on T024, T025)

- [ ] T026 [US3] Implement folder repository with ordering in `apps/web/lib/indexeddb/folders-repository.ts` (Depends: T024)
- [ ] T027 [US3] Implement custom view schema + validation in `apps/web/lib/organization/custom-view-schema.ts` (Depends: T024)
- [ ] T028 [US3] Build folder tree UI with drag-drop in `apps/web/components/organization/folder-tree.tsx` (Depends: T025)
- [ ] T029 [US3] Build custom views manager page in `apps/web/app/feeds/views/page.tsx` (Depends: T024, T025)

**Parallel Work Example**: Repository logic (T026–T027) can proceed while UI tasks (T028–T029) consume mock data derived from tests T024–T025.

---

## Phase 6: User Story 4 - Browser Extension Integration 🔌 (Priority: P4)

**Goal**: Deliver a Manifest V3 extension that saves articles and feeds into the web app via client-side messaging, keeping everything offline-capable.

**Independent Test**: Load unpacked extension, save an article, and verify it appears in the in-app reading list with queued status; subscribe to RSS via context menu and confirm immediate availability.

### Tests (write first) — COMPLETE BEFORE IMPLEMENTATION

- [ ] T030 [P] [US4] Add Playwright extension queue handshake test in `apps/web/tests/e2e/extension-queue.spec.ts`
- [ ] T031 [P] [US4] Add Vitest postMessage handler tests in `apps/web/tests/unit/extension/message-handler.test.ts`
- [ ] T032 [P] [US4] Add Playwright Firefox compatibility test with browser-polyfill in `apps/web/tests/e2e/extension-firefox.spec.ts`

### Implementation (Depends on T030-T032)

- [ ] T033 [US4] Scaffold Manifest V3 configuration in `apps/web/extension/manifest.json` (Depends: T030)
- [ ] T034 [US4] Implement extension background worker in `apps/web/extension/src/background.ts` (Depends: T031, T032)
- [ ] T035 [US4] Implement web app bridge for extension messages in `apps/web/app/feeds/reading-list/extension-bridge.ts` (Depends: T031)
- [ ] T036 [US4] Build reading list page with queue management in `apps/web/app/feeds/reading-list/page.tsx` (Depends: T030)

**Parallel Work Example**: Extension code (T032–T033) can evolve independently while in-app bridge/UI (T034–T035) honours contracts defined in T031.

---

## Phase 7: User Story 5 - Export & Data Portability 📤 (Priority: P5)

**Goal**: Allow users to export/import their data in JSON, CSV, OPML, and HTML formats fully client-side.

**Independent Test**: Generate all export formats for seeded data (<5 s each), import JSON on a fresh profile, and confirm parity with original state.

### Tests (write first) — COMPLETE BEFORE IMPLEMENTATION

- [ ] T037 [P] [US5] Add Vitest export builder tests in `apps/web/tests/unit/export/export-builder.test.ts`
- [ ] T038 [P] [US5] Add Playwright export/import smoke test (<5s threshold) in `apps/web/tests/e2e/export-import.spec.ts`

### Implementation (Depends on T037-T038)

- [ ] T039 [US5] Implement export service (JSON/CSV/OPML/HTML) in `apps/web/lib/exports/export-service.ts` (Depends: T037, T038)
- [ ] T040 [US5] Implement import service with validation in `apps/web/lib/exports/import-service.ts` (Depends: T037, T038)
- [ ] T041 [US5] Build data portability settings page in `apps/web/app/settings/data-portability/page.tsx` (Depends: T038)
- [ ] T042 [US5] Implement HTML export templates in `apps/web/app/settings/data-portability/export-templates.ts` (Depends: T037)

**Parallel Work Example**: T038 and T039 may iterate concurrently once schema contracts from tests T036–T037 are locked in.

---

## Phase 8: Polish & Cross-Cutting Enhancements

**Purpose**: Deliver additional client-side power features (keyboard shortcuts, theming, analytics, annotations, smart filters, AI) plus final validation.

- [ ] T043 [P] Implement keyboard shortcut map with customization UI (includes import/export of shortcuts) in `apps/web/lib/shortcuts/shortcut-map.ts`
- [ ] T044 [P] Implement appearance settings (themes, contrast, typography) in `apps/web/app/settings/appearance/page.tsx`
- [ ] T045 Implement reading statistics dashboards (articles/day, time, topics, streaks) in `apps/web/app/stats/page.tsx`
- [ ] T046 [P] Implement annotation panel and persistence (immediate writes to IndexedDB) in `apps/web/components/annotations/annotation-panel.tsx`
- [ ] T047 Implement smart filter rule engine in `apps/web/lib/filters/rule-engine.ts`
- [ ] T048 [P] Enhance PWA manifest & local notifications in `apps/web/manifest.ts`
- [ ] T049 Document Phase 4 features in `apps/web/content/docs/features/client-side.mdx` and update `meta.json`
- [ ] T050 Implement storage quota monitoring UI (70/80/90% thresholds) in `apps/web/app/settings/storage/page.tsx`
- [ ] T051 Build conflict resolution panel for offline sync conflicts in `apps/web/app/offline/conflicts/page.tsx`
- [ ] T052 Create empty state onboarding wizard with suggested AI/ML feeds in `apps/web/app/onboarding/page.tsx`
- [ ] T053 Implement Service Worker failure graceful degradation and banner notification in `apps/web/components/offline/sw-status-banner.tsx`
- [ ] T054 Build diagnostic log export feature (<500 entries) in `apps/web/app/settings/diagnostics/page.tsx`
- [ ] T055 Create performance metrics dashboard (<50ms search, <16ms UI, <5s exports) in `apps/web/app/stats/performance/page.tsx`
- [ ] T056 Integrate IndexedDB migration testing with data preservation in `apps/web/tests/integration/db-migrations.test.ts`
- [ ] T057 Create `contracts/view-filters.schema.json` for CustomView validation
- [ ] T058 Validate end-to-end quickstart scenarios using `specs/004-client-side-features/quickstart.md` (verify all commands execute successfully from clean state)

---

## Dependencies & Execution Order

### Phase Dependencies

1. **Setup (Phase 1)** → unlocks Foundational work.  
2. **Foundational (Phase 2)** → must complete before User Stories begin.  
3. **User Stories (Phases 3–7)** → execute sequentially by priority (P1 → P5), but later stories can start once their prerequisites are met (see graph).  
4. **Polish (Phase 8)** → begins after core user stories targeted for release are complete.

### User Story Dependency Graph

```
US1 (P1) → US2 (P2)
US1 (P1) → US3 (P3)
US1 (P1) → US4 (P4)
US2 (P2) → US5 (P5)
US3 (P3) ─┐
US4 (P4) ─┴─→ US5 (P5)
```

### Completeness Check

- Each user story has dedicated test + implementation tasks covering data layer, workers, and UI.  
- Export story (US5) depends on prior stories for populated data but remains independently testable with seeded fixtures.  
- Polish tasks operate only after stories complete, ensuring no hidden dependencies.

---

## Parallel Execution Opportunities

- **Setup**: T003 and T004 can run in parallel after T001.  
- **US1**: UI work (T015–T017) can proceed alongside worker logic (T013–T014) once tests are drafted.  
- **US2**: Worker (T020) and UI (T022) can iterate concurrently using mocks defined in T018.  
- **US3**: Repository tasks (T026–T027) and UI tasks (T028–T029) can be split across devs.  
- **US4**: Extension code (T032–T033) and web bridge (T034–T035) progress in parallel after T030/T031.  
- **US5**: Export (T038) and import (T039) can run simultaneously against shared test fixtures.  
- **Polish**: T042–T047 touch distinct modules, enabling team-wide parallelization before final validation (T048).

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 & 2 foundations.  
2. Deliver **US1 (Offline Reading)** with passing tests → MVP ready for stakeholder review.

### Incremental Delivery

1. Add **US2 (Search)** to enhance discovery.  
2. Add **US3 (Organization)** for productivity workflows.  
3. Add **US4 (Extension)** to capture inbound content quickly.  
4. Add **US5 (Exports)** to satisfy privacy & portability guarantees.  
5. Apply Phase 8 polish before release.

### Team Parallelization

After foundations:
- Developer A: US1 → US4  
- Developer B: US2 → US5  
- Developer C: US3 → Polish  

Each stream maintains independent test suites per story, enabling safe merges and staged releases.
