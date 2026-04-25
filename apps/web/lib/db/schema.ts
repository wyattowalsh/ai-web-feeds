/**
 * IndexedDB Schema for AI Web Feeds
 *
 * All data stored client-side for offline-first functionality.
 * No backend required - complete user privacy and instant performance.
 */

export const DB_NAME = "aiwebfeeds";
export const DB_VERSION = 1;

/**
 * Database Store Names
 */
export const STORES = {
  ARTICLES: "articles",
  FEEDS: "feeds",
  FOLDERS: "folders",
  READING_HISTORY: "readingHistory",
  ANNOTATIONS: "annotations",
  SEARCH_INDEX: "searchIndex",
  PREFERENCES: "preferences",
  SYNC_QUEUE: "syncQueue",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

/**
 * Article stored in IndexedDB
 */
export interface Article {
  id: string;
  feedId: string;
  title: string;
  link: string;
  content: string;
  summary?: string;
  author?: string;
  pubDate: number | null; // Unix timestamp when provided by the source feed
  categories: string[];
  enclosures: Enclosure[];
  read: boolean;
  starred: boolean;
  archived: boolean;
  tags: string[];
  readingTime?: number; // Estimated minutes
  wordCount?: number;
  cachedAt: number; // When article was saved to IndexedDB
  lastModified: number;
}

export interface Enclosure {
  url: string;
  type: string;
  length?: number;
}

/**
 * Feed stored in IndexedDB
 */
export interface Feed {
  id: string;
  url: string;
  title: string;
  description?: string;
  link?: string;
  imageUrl?: string;
  category?: string;
  folderId?: string;
  lastSync: number;
  syncInterval: number; // Minutes
  enabled: boolean;
  unreadCount: number;
  errorCount: number;
  lastError?: string;
  metadata: {
    ttl?: number;
    etag?: string;
    lastModified?: string;
  };
  createdAt: number;
  updatedAt: number;
}

/**
 * Folder for organizing feeds
 */
export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  position: number;
  collapsed: boolean;
  color?: string;
  icon?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Reading history entry
 */
export interface ReadingHistoryEntry {
  id: string;
  articleId: string;
  timestamp: number;
  duration: number; // Seconds spent reading
  scrollDepth: number; // Percentage (0-100)
  completed: boolean;
}

/**
 * Article annotation (highlights, notes)
 */
export interface Annotation {
  id: string;
  articleId: string;
  type: "highlight" | "note" | "bookmark";
  content: string;
  selectionText?: string;
  startOffset?: number;
  endOffset?: number;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Search index term
 */
export interface SearchIndexEntry {
  term: string;
  articleIds: string[];
  frequency: number;
  lastUsed: number;
}

/**
 * User preferences
 */
export interface Preferences {
  id: "user_prefs"; // Singleton
  theme: "light" | "dark" | "system";
  fontSize: number;
  fontFamily: string;
  readingWidth: "narrow" | "medium" | "wide";
  layout: "list" | "cards" | "compact";
  showImages: boolean;
  showSummaries: boolean;
  markAsReadOnScroll: boolean;
  keyboardShortcuts: Record<string, string>;
  offlineMode: boolean;
  syncOnStartup: boolean;
  updatedAt: number;
}

/**
 * Sync queue for offline changes
 */
export interface SyncQueueItem {
  id: string;
  type: "read" | "star" | "archive" | "tag" | "annotation";
  articleId: string;
  data: Record<string, unknown>;
  timestamp: number;
  synced: boolean;
}

/**
 * Database store schema definitions
 */
export function createDatabase(db: IDBDatabase): void {
  // Articles store
  if (!db.objectStoreNames.contains(STORES.ARTICLES)) {
    const articlesStore = db.createObjectStore(STORES.ARTICLES, { keyPath: "id" });
    articlesStore.createIndex("feedId", "feedId", { unique: false });
    articlesStore.createIndex("pubDate", "pubDate", { unique: false });
    articlesStore.createIndex("read", "read", { unique: false });
    articlesStore.createIndex("starred", "starred", { unique: false });
    articlesStore.createIndex("tags", "tags", { unique: false, multiEntry: true });
    articlesStore.createIndex("cachedAt", "cachedAt", { unique: false });
  }

  // Feeds store
  if (!db.objectStoreNames.contains(STORES.FEEDS)) {
    const feedsStore = db.createObjectStore(STORES.FEEDS, { keyPath: "id" });
    feedsStore.createIndex("folderId", "folderId", { unique: false });
    feedsStore.createIndex("lastSync", "lastSync", { unique: false });
    feedsStore.createIndex("category", "category", { unique: false });
    feedsStore.createIndex("enabled", "enabled", { unique: false });
  }

  // Folders store
  if (!db.objectStoreNames.contains(STORES.FOLDERS)) {
    const foldersStore = db.createObjectStore(STORES.FOLDERS, { keyPath: "id" });
    foldersStore.createIndex("parentId", "parentId", { unique: false });
    foldersStore.createIndex("position", "position", { unique: false });
  }

  // Reading history store
  if (!db.objectStoreNames.contains(STORES.READING_HISTORY)) {
    const historyStore = db.createObjectStore(STORES.READING_HISTORY, { keyPath: "id" });
    historyStore.createIndex("articleId", "articleId", { unique: false });
    historyStore.createIndex("timestamp", "timestamp", { unique: false });
  }

  // Annotations store
  if (!db.objectStoreNames.contains(STORES.ANNOTATIONS)) {
    const annotationsStore = db.createObjectStore(STORES.ANNOTATIONS, { keyPath: "id" });
    annotationsStore.createIndex("articleId", "articleId", { unique: false });
    annotationsStore.createIndex("type", "type", { unique: false });
    annotationsStore.createIndex("createdAt", "createdAt", { unique: false });
  }

  // Search index store
  if (!db.objectStoreNames.contains(STORES.SEARCH_INDEX)) {
    const searchStore = db.createObjectStore(STORES.SEARCH_INDEX, { keyPath: "term" });
    searchStore.createIndex("frequency", "frequency", { unique: false });
    searchStore.createIndex("lastUsed", "lastUsed", { unique: false });
  }

  // Preferences store (singleton)
  if (!db.objectStoreNames.contains(STORES.PREFERENCES)) {
    db.createObjectStore(STORES.PREFERENCES, { keyPath: "id" });
  }

  // Sync queue store
  if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
    const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: "id" });
    syncStore.createIndex("synced", "synced", { unique: false });
    syncStore.createIndex("timestamp", "timestamp", { unique: false });
    syncStore.createIndex("type", "type", { unique: false });
  }
}

/**
 * Default preferences
 */
export const DEFAULT_KEYBOARD_SHORTCUTS: Record<string, string> = {
  j: "next_article",
  k: "previous_article",
  m: "mark_as_read",
  s: "star",
  a: "archive",
  v: "open_original",
  r: "refresh",
  "/": "search",
  "g h": "go_home",
  "g s": "go_starred",
  "g u": "go_unread",
  "g a": "go_all",
  escape: "close_modal",
  "?": "show_shortcuts",
  "[": "toggle_sidebar",
  "ctrl+k": "focus_search",
  "meta+k": "focus_search",
};

export const DEFAULT_PREFERENCES: Preferences = {
  id: "user_prefs",
  theme: "system",
  fontSize: 16,
  fontFamily: "system-ui",
  readingWidth: "medium",
  layout: "cards",
  showImages: true,
  showSummaries: true,
  markAsReadOnScroll: false,
  keyboardShortcuts: {
    j: "next_article",
    k: "previous_article",
    m: "mark_as_read",
    s: "star",
    v: "open_original",
    r: "refresh",
    "/": "search",
    "g h": "go_home",
    "g s": "go_starred",
    "g u": "go_unread",
    escape: "close_modal",
  },
  offlineMode: false,
  syncOnStartup: true,
  updatedAt: Date.now(),
};

const REQUIRED_PREFERENCE_KEYS: ReadonlyArray<keyof Preferences> = [
  "id",
  "theme",
  "fontSize",
  "fontFamily",
  "readingWidth",
  "layout",
  "showImages",
  "showSummaries",
  "markAsReadOnScroll",
  "keyboardShortcuts",
  "offlineMode",
  "syncOnStartup",
  "updatedAt",
];

export function normalizePreferences(prefs?: Partial<Preferences> | null): Preferences {
  const record = isRecord(prefs) ? prefs : {};

  return {
    id: DEFAULT_PREFERENCES.id,
    theme: VALID_THEME_MODES.has(record.theme as Preferences["theme"])
      ? (record.theme as Preferences["theme"])
      : DEFAULT_PREFERENCES.theme,
    fontSize:
      typeof record.fontSize === "number" && Number.isFinite(record.fontSize) && record.fontSize > 0
        ? record.fontSize
        : DEFAULT_PREFERENCES.fontSize,
    fontFamily:
      typeof record.fontFamily === "string" && record.fontFamily.trim().length > 0
        ? record.fontFamily.trim()
        : DEFAULT_PREFERENCES.fontFamily,
    readingWidth: VALID_READING_WIDTHS.has(record.readingWidth as Preferences["readingWidth"])
      ? (record.readingWidth as Preferences["readingWidth"])
      : DEFAULT_PREFERENCES.readingWidth,
    layout: VALID_LAYOUTS.has(record.layout as Preferences["layout"])
      ? (record.layout as Preferences["layout"])
      : DEFAULT_PREFERENCES.layout,
    showImages:
      typeof record.showImages === "boolean" ? record.showImages : DEFAULT_PREFERENCES.showImages,
    showSummaries:
      typeof record.showSummaries === "boolean"
        ? record.showSummaries
        : DEFAULT_PREFERENCES.showSummaries,
    markAsReadOnScroll:
      typeof record.markAsReadOnScroll === "boolean"
        ? record.markAsReadOnScroll
        : DEFAULT_PREFERENCES.markAsReadOnScroll,
    keyboardShortcuts: normalizeShortcutBindings(record.keyboardShortcuts),
    offlineMode:
      typeof record.offlineMode === "boolean"
        ? record.offlineMode
        : DEFAULT_PREFERENCES.offlineMode,
    syncOnStartup:
      typeof record.syncOnStartup === "boolean"
        ? record.syncOnStartup
        : DEFAULT_PREFERENCES.syncOnStartup,
    updatedAt:
      typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
        ? record.updatedAt
        : DEFAULT_PREFERENCES.updatedAt,
  };
}

export function preferencesNeedMigration(prefs?: Partial<Preferences> | null): boolean {
  if (!isRecord(prefs) || prefs.id !== DEFAULT_PREFERENCES.id) {
    return true;
  }

  if (!VALID_THEME_MODES.has(prefs.theme as Preferences["theme"])) {
    return true;
  }

  if (
    typeof prefs.fontSize !== "number" ||
    !Number.isFinite(prefs.fontSize) ||
    prefs.fontSize <= 0
  ) {
    return true;
  }

  if (typeof prefs.fontFamily !== "string" || prefs.fontFamily.trim().length === 0) {
    return true;
  }

  if (!VALID_READING_WIDTHS.has(prefs.readingWidth as Preferences["readingWidth"])) {
    return true;
  }

  if (!VALID_LAYOUTS.has(prefs.layout as Preferences["layout"])) {
    return true;
  }

  if (
    typeof prefs.showImages !== "boolean" ||
    typeof prefs.showSummaries !== "boolean" ||
    typeof prefs.markAsReadOnScroll !== "boolean" ||
    typeof prefs.offlineMode !== "boolean" ||
    typeof prefs.syncOnStartup !== "boolean" ||
    typeof prefs.updatedAt !== "number" ||
    !Number.isFinite(prefs.updatedAt)
  ) {
    return true;
  }

  if (hasInvalidShortcutBindings(prefs.keyboardShortcuts)) {
    return true;
  }

  return REQUIRED_PREFERENCE_KEYS.some((key) => prefs[key] === undefined);
}

function getOrCreateStore(
  db: IDBDatabase,
  transaction: IDBTransaction | null,
  storeName: StoreName,
  definition: StoreDefinition,
): IDBObjectStore {
  if (!db.objectStoreNames.contains(storeName)) {
    return db.createObjectStore(storeName, { keyPath: definition.keyPath });
  }

  if (!transaction) {
    throw new Error(`Upgrade transaction is required to migrate existing store "${storeName}"`);
  }

  return transaction.objectStore(storeName);
}

function ensureIndexes(store: IDBObjectStore, indexes: StoreDefinition["indexes"] = {}): void {
  for (const [indexName, definition] of Object.entries(indexes)) {
    if (!store.indexNames.contains(indexName)) {
      store.createIndex(indexName, definition.keyPath, definition.options);
    }
  }
}

function seedPreferencesStore(store: IDBObjectStore): void {
  const request = store.get(DEFAULT_PREFERENCES.id);

  request.onsuccess = () => {
    const current = request.result as Partial<Preferences> | undefined;
    if (preferencesNeedMigration(current)) {
      store.put(normalizePreferences(current));
    }
  };
}

/**
 * Create IndexedDB database with all stores
 */
export function createDatabase(db: IDBDatabase, transaction: IDBTransaction | null): void {
  for (const [storeName, definition] of Object.entries(STORE_DEFINITIONS) as Array<
    [StoreName, StoreDefinition]
  >) {
    const store = getOrCreateStore(db, transaction, storeName, definition);
    ensureIndexes(store, definition.indexes);
  }

  if (transaction) {
    seedPreferencesStore(transaction.objectStore(STORES.PREFERENCES));
  }
}

/**
 * Storage quota information
 */
export interface StorageQuota {
  usage: number;
  quota: number;
  percentage: number;
}

/**
 * Get storage quota information
 */
export async function getStorageQuota(): Promise<StorageQuota> {
  if ("storage" in navigator && "estimate" in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percentage = quota > 0 ? (usage / quota) * 100 : 0;

    return { usage, quota, percentage };
  }

  return { usage: 0, quota: 0, percentage: 0 };
}

/**
 * Request persistent storage (prevents eviction)
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if ("storage" in navigator && "persist" in navigator.storage) {
    return await navigator.storage.persist();
  }
  return false;
}

/**
 * Check if persistent storage is granted
 */
export async function isPersistentStorageGranted(): Promise<boolean> {
  if ("storage" in navigator && "persisted" in navigator.storage) {
    return await navigator.storage.persisted();
  }
  return false;
}
