# Data Model — Phase 4 Client-Side Features

## Overview

Phase 4 broadens the client-only data footprint. IndexedDB remains the source of truth for articles, feeds, annotations, analytics, and AI output, while localStorage captures light-weight preferences. Cache Storage serves static assets and export blobs. The model must support offline-first capabilities, instant search, customizable organization, extension ingestion, and analytics/AI overlays—all without backend services.

## Storage Allocation

| Domain | Store | Key Path | Notes |
|--------|-------|----------|-------|
| Articles | IndexedDB `articles` | `id` (UUID) | Canonical article data + offline metadata |
| Feeds | IndexedDB `feeds` | `id` (UUID) | Stores sync metadata, retention preferences |
| Folders | IndexedDB `folders` | `id` (UUID) | Hierarchical feed grouping |
| Custom Views | IndexedDB `views` | `id` (UUID) | Serialized filter definitions |
| Reading History | IndexedDB `reading_history` | `id` (UUID) | Tracks read events, time spent |
| Search Index | IndexedDB `search_index` | `term` | Inverted index posting lists for Web Worker search |
| Annotations | IndexedDB `annotations` | `id` (UUID) | Highlights, notes, tags |
| Offline Tasks | IndexedDB `offline_tasks` | `id` (UUID) | Background sync queue + status |
| Log Buffer | localStorage `aiwebfeeds.logs` | — | 500-entry rolling diagnostic buffer |
| Preferences | localStorage `aiwebfeeds.prefs` | — | Theme, shortcuts, view settings |
| Storage Snapshot | localStorage `aiwebfeeds.storage` | — | Cached `navigator.storage.estimate` results |
| Export Blobs | Cache Storage `exports` | URL hash | Temporary download artifacts |
| Extension Queue | IndexedDB `extension_queue` | `id` (UUID) | Pending items from the browser extension |

## Entities

### Article
- **Fields**: `id`, `feedId`, `title`, `url`, `author`, `publishedAt`, `content` (HTML/Markdown), `summary`, `tags[]`, `starred` (bool), `readAt`, `offlineStatus` (`fresh | stale | conflicted`), `lastSyncedAt`, `sourceFingerprint` (SHA-256 hash of `url + publishedAt + title` for duplicate detection), `conflictReason?`.
- **Relationships**: belongs to `Feed`; has many `Annotation`; referenced by `ReadingHistory` entries and `CustomView` filters.
- **Validation**: `id` unique (UUID v4); `url` absolute; `publishedAt` ISO timestamp; `offlineStatus` defaults to `fresh`; `conflictReason` required when status `conflicted`; `sourceFingerprint` computed on insert/update.

### Feed
- **Fields**: `id`, `title`, `siteUrl`, `feedUrl`, `iconUrl`, `folderId?`, `lastSyncAt`, `syncIntervalMinutes`, `retentionDays`, `unreadCount`, `priority` (`low | normal | high`), `topics[]`.
- **Relationships**: optional parent `Folder`; referenced by many `Article`.
- **Validation**: URLs absolute; `syncIntervalMinutes` ≥15; `retentionDays` default 90; enforce `folderId` exists when set.

### Folder
- **Fields**: `id`, `name`, `parentId?`, `position`, `collapsed` (bool).
- **Relationships**: self-referential parent-child tree; feeds reference folders.
- **Validation**: `position` integer ≥0; prevent circular parent references; root folders have `parentId = null`.

### CustomView
- **Fields**: `id`, `name`, `filters` (JSON schema), `sort` (`relevance | date | readTime`), `pinned` (bool), `createdAt`.
- **Relationships**: filters reference `Feed`, `Article` tags/topics.
- **Validation**: `filters` must satisfy `view-filters.schema.json`; require unique `name` per user.

### ReadingHistoryEntry
- **Fields**: `id`, `articleId`, `feedId`, `startedAt`, `completedAt?`, `durationSeconds`, `device` (`desktop | mobile`), `readingMode` (`standard | focused`).
- **Relationships**: belongs to `Article`; aggregated by analytics dashboards.
- **Validation**: `completedAt` ≥ `startedAt` when present; `durationSeconds` derived from difference; enforce referential integrity on `articleId`.

### Annotation
- **Fields**: `id`, `articleId`, `type` (`highlight | note`), `selector` (TextQuoteSelector per [W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/#selectors)), `content`, `createdAt`, `updatedAt`, `color`, `tags[]`.
- **Relationships**: belongs to `Article`; optionally grouped in export bundles.
- **Validation**: `selector` conforms to W3C Web Annotation Data Model TextQuoteSelector (exact match with optional prefix/suffix); `content` length ≤10k characters; `updatedAt` ≥ `createdAt`.
- **Persistence Strategy**: Immediate writes to IndexedDB on annotation creation/update (no debouncing) to prevent data loss on tab close.

### SearchIndexTerm
- **Fields**: `term`, `postings[]` (array of `{ articleId, weight, positions[] }`), `lastUpdated`, `docFrequency`.
- **Relationships**: `postings.articleId` references `Article`.
- **Validation**: `term` lowercased normalized; `weight` normalized float (0-1); `positions` ascending integers representing **word index** (0-based position of term occurrence in tokenized article content, e.g., "the quick brown fox" → "fox" at position 3).

### OfflineTask
- **Fields**: `id`, `type` (`cacheFeeds | purgeArticles | resolveConflicts`), `payload` (JSON), `status` (`pending | running | complete | failed`), `createdAt`, `updatedAt`, `retryCount`, `error?`.
- **Relationships**: orchestrated by Service Worker background sync; may reference `Feed`/`Article`.
- **Validation**: `retryCount` <=3; `error` required when status `failed`; `payload` validated per task-specific schema.

### ExtensionQueueItem
- **Fields**: `id`, `source` (`chrome-extension | firefox-extension`), `url`, `title`, `author?`, `capturedAt`, `status` (`queued | imported | dismissed`), `metadata` (JSON).
- **Relationships**: consumed by main app to create `Article` or reading-list entries.
- **Validation**: `url` absolute; `capturedAt` ISO timestamp; `metadata` max 10 kB.

### PreferenceState (localStorage)
- **Fields** (stored as JSON): `theme`, `contrast`, `fontSize`, `shortcutBindings` (Record<string, string> mapping action names to key combinations, e.g., `{"markAsRead": "m", "starArticle": "s", "search": "/"}`), `defaultViewId`, `notificationsEnabled`, `aiFeaturesEnabled`.
- **Validation**: Schema-enforced before write; unknown keys discarded to prevent schema drift; `shortcutBindings` validated as valid KeyboardEvent key strings.

### DiagnosticLogEntry (localStorage buffer)
- **Fields**: `timestamp`, `level` (`info | warn | error`), `context`, `message`, `stack?`.
- **Behavior**: Append to rolling buffer (max 500). Exported via JSON when user chooses.

## State Transitions

### Article Offline Lifecycle
1. `fresh` → `stale`: background sync detects remote updates (timestamp drift).
2. `stale` → `fresh`: article data refreshed and merged.
3. `fresh` → `conflicted`: remote delete or divergence while user has local edits; `conflictReason` annotated.
4. `conflicted` → `fresh`: user resolves conflict via UI (keep local / accept remote).

### OfflineTask Workflow
`pending` → `running` (Service Worker sync event) → `complete` or `failed`. `failed` increments `retryCount`; after 3 retries tasks flagged for manual intervention and surfaced in settings.

### Custom View Editing
Draft filter changes stored in memory → persisted to IndexedDB on save → broadcast to open tabs via BroadcastChannel API for multi-tab sync.

### Storage Quota Alerts
`usageRatio` <0.7 = normal → ≥0.7 triggers info toast → ≥0.8 triggers persistent warning & cleanup dialog → ≥0.9 blocks new downloads until space freed.

## Validation & Indexing Rules

- Apply JSON Schema validation before inserting/updating `CustomView`, `OfflineTask`, and `Annotation` payloads.
- Enforce trimmed strings and normalized casing for tags/topics.
- Maintain compound indexes:
  - `articles`: indexes `feedId`, `publishedAt`, `starred`, `readAt`, `tags`.
  - `reading_history`: index by `articleId`, `timestamp`.
  - `annotations`: index by `articleId`, `createdAt`.
  - `search_index`: index by `term`, `lastUpdated`.
- Background worker maintains inverted index (full-text search data structure mapping terms to article locations) and stores token metadata in `search_index`.

## Derived Metrics

- Reading statistics derived by aggregating `ReadingHistoryEntry` grouped by date/topic.
- Storage dashboard aggregates `navigator.storage.estimate()` plus per-store `count` and `size` (Dexie `table.stats()`).
- AI summaries stored as `Annotation` with `type = note` and `source = ai` tag for traceability.
