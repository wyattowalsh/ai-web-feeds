/**
 * IndexedDB Schema for AI Web Feeds
 * 
 * All data stored client-side for offline-first functionality.
 * No backend required - complete user privacy and instant performance.
 */

export const DB_NAME = 'aiwebfeeds';
export const DB_VERSION = 1;

/**
 * Database Store Names
 */
export const STORES = {
  ARTICLES: 'articles',
  FEEDS: 'feeds',
  FOLDERS: 'folders',
  READING_HISTORY: 'readingHistory',
  ANNOTATIONS: 'annotations',
  SEARCH_INDEX: 'searchIndex',
  PREFERENCES: 'preferences',
  SYNC_QUEUE: 'syncQueue',
} as const;

export type StoreName = typeof STORES[keyof typeof STORES];

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
  pubDate: number; // Unix timestamp
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
  type: 'highlight' | 'note' | 'bookmark';
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
  id: 'user_prefs'; // Singleton
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  fontFamily: string;
  readingWidth: 'narrow' | 'medium' | 'wide';
  layout: 'list' | 'cards' | 'compact';
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
  type: 'read' | 'star' | 'archive' | 'tag' | 'annotation';
  articleId: string;
  data: Record<string, unknown>;
  timestamp: number;
  synced: boolean;
}

/**
 * Create IndexedDB database with all stores
 */
export function createDatabase(db: IDBDatabase): void {
  // Articles store
  if (!db.objectStoreNames.contains(STORES.ARTICLES)) {
    const articlesStore = db.createObjectStore(STORES.ARTICLES, { keyPath: 'id' });
    articlesStore.createIndex('feedId', 'feedId', { unique: false });
    articlesStore.createIndex('pubDate', 'pubDate', { unique: false });
    articlesStore.createIndex('read', 'read', { unique: false });
    articlesStore.createIndex('starred', 'starred', { unique: false });
    articlesStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
    articlesStore.createIndex('cachedAt', 'cachedAt', { unique: false });
  }

  // Feeds store
  if (!db.objectStoreNames.contains(STORES.FEEDS)) {
    const feedsStore = db.createObjectStore(STORES.FEEDS, { keyPath: 'id' });
    feedsStore.createIndex('folderId', 'folderId', { unique: false });
    feedsStore.createIndex('lastSync', 'lastSync', { unique: false });
    feedsStore.createIndex('category', 'category', { unique: false });
    feedsStore.createIndex('enabled', 'enabled', { unique: false });
  }

  // Folders store
  if (!db.objectStoreNames.contains(STORES.FOLDERS)) {
    const foldersStore = db.createObjectStore(STORES.FOLDERS, { keyPath: 'id' });
    foldersStore.createIndex('parentId', 'parentId', { unique: false });
    foldersStore.createIndex('position', 'position', { unique: false });
  }

  // Reading history store
  if (!db.objectStoreNames.contains(STORES.READING_HISTORY)) {
    const historyStore = db.createObjectStore(STORES.READING_HISTORY, { keyPath: 'id' });
    historyStore.createIndex('articleId', 'articleId', { unique: false });
    historyStore.createIndex('timestamp', 'timestamp', { unique: false });
  }

  // Annotations store
  if (!db.objectStoreNames.contains(STORES.ANNOTATIONS)) {
    const annotationsStore = db.createObjectStore(STORES.ANNOTATIONS, { keyPath: 'id' });
    annotationsStore.createIndex('articleId', 'articleId', { unique: false });
    annotationsStore.createIndex('type', 'type', { unique: false });
    annotationsStore.createIndex('createdAt', 'createdAt', { unique: false });
  }

  // Search index store
  if (!db.objectStoreNames.contains(STORES.SEARCH_INDEX)) {
    const searchStore = db.createObjectStore(STORES.SEARCH_INDEX, { keyPath: 'term' });
    searchStore.createIndex('frequency', 'frequency', { unique: false });
    searchStore.createIndex('lastUsed', 'lastUsed', { unique: false });
  }

  // Preferences store (singleton)
  if (!db.objectStoreNames.contains(STORES.PREFERENCES)) {
    db.createObjectStore(STORES.PREFERENCES, { keyPath: 'id' });
  }

  // Sync queue store
  if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
    const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
    syncStore.createIndex('synced', 'synced', { unique: false });
    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
    syncStore.createIndex('type', 'type', { unique: false });
  }
}

/**
 * Default preferences
 */
export const DEFAULT_PREFERENCES: Preferences = {
  id: 'user_prefs',
  theme: 'system',
  fontSize: 16,
  fontFamily: 'system-ui',
  readingWidth: 'medium',
  layout: 'cards',
  showImages: true,
  showSummaries: true,
  markAsReadOnScroll: false,
  keyboardShortcuts: {
    'j': 'next_article',
    'k': 'previous_article',
    'm': 'mark_as_read',
    's': 'star',
    'v': 'open_original',
    'r': 'refresh',
    '/': 'search',
    'g h': 'go_home',
    'g s': 'go_starred',
    'g u': 'go_unread',
    'escape': 'close_modal',
  },
  offlineMode: false,
  syncOnStartup: true,
  updatedAt: Date.now(),
};

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
  if ('storage' in navigator && 'estimate' in navigator.storage) {
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
  if ('storage' in navigator && 'persist' in navigator.storage) {
    return await navigator.storage.persist();
  }
  return false;
}

/**
 * Check if persistent storage is granted
 */
export async function isPersistentStorageGranted(): Promise<boolean> {
  if ('storage' in navigator && 'persisted' in navigator.storage) {
    return await navigator.storage.persisted();
  }
  return false;
}

