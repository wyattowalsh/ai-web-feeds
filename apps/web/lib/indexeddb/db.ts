/**
 * IndexedDB facade — re-exports the raw IndexedDB API used across client features.
 *
 * Spec 004 originally referenced Dexie; delivery uses `lib/db` (raw IndexedDB) for
 * offline-first storage. Import from here for story-level modules that expect
 * `lib/indexeddb/*` paths.
 */

export {
  openDB,
  closeDB,
  articles,
  feeds,
  folders,
  readingHistory,
  annotations,
  searchIndex,
  preferences,
  syncQueue,
} from "@/lib/db";

export { getStorageQuota } from "@/lib/db/schema";

export type {
  Article,
  Feed,
  Folder,
  ReadingHistoryEntry,
  Annotation,
  SearchIndexEntry,
  Preferences,
  SyncQueueItem,
  StoreName,
} from "@/lib/db/schema";

export { DB_NAME, DB_VERSION, STORES, DEFAULT_PREFERENCES } from "@/lib/db/schema";
