/**
 * IndexedDB Database Manager
 *
 * Provides a clean API for all IndexedDB operations.
 * Handles connection management, transactions, and error handling.
 */

import {
  DB_NAME,
  DB_VERSION,
  STORES,
  createDatabase,
  type StoreName,
  type Article,
  type Feed,
  type Folder,
  type ReadingHistoryEntry,
  type Annotation,
  type SearchIndexEntry,
  type Preferences,
  type SyncQueueItem,
  DEFAULT_PREFERENCES,
} from './schema';

/**
 * Database connection singleton
 */
let dbInstance: IDBDatabase | null = null;

/**
 * Open IndexedDB connection
 */
export async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open database: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      createDatabase(db);
    };
  });
}

/**
 * Close database connection
 */
export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Generic get operation
 */
export async function get<T>(
  storeName: StoreName,
  key: string | number
): Promise<T | undefined> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic get all operation
 */
export async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic put operation (add or update)
 */
export async function put<T>(storeName: StoreName, value: T): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic delete operation
 */
export async function del(storeName: StoreName, key: string | number): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic clear operation (delete all records)
 */
export async function clear(storeName: StoreName): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get records by index
 */
export async function getByIndex<T>(
  storeName: StoreName,
  indexName: string,
  value: string | number | boolean
): Promise<T[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Count records in store
 */
export async function count(storeName: StoreName): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Bulk put operation
 */
export async function bulkPut<T>(storeName: StoreName, values: T[]): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    let completed = 0;
    const total = values.length;

    values.forEach((value) => {
      const request = store.put(value);

      request.onsuccess = () => {
        completed++;
        if (completed === total) {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });

    if (total === 0) {
      resolve();
    }
  });
}

/**
 * Query with range
 */
export async function getByRange<T>(
  storeName: StoreName,
  indexName: string,
  lowerBound?: number,
  upperBound?: number
): Promise<T[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);

    let range: IDBKeyRange | undefined;
    if (lowerBound !== undefined && upperBound !== undefined) {
      range = IDBKeyRange.bound(lowerBound, upperBound);
    } else if (lowerBound !== undefined) {
      range = IDBKeyRange.lowerBound(lowerBound);
    } else if (upperBound !== undefined) {
      range = IDBKeyRange.upperBound(upperBound);
    }

    const request = range ? index.getAll(range) : index.getAll();

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

// ============================================================================
// Specialized API methods for each store
// ============================================================================

/**
 * Articles API
 */
export const articles = {
  get: (id: string) => get<Article>(STORES.ARTICLES, id),
  getAll: () => getAll<Article>(STORES.ARTICLES),
  put: (article: Article) => put(STORES.ARTICLES, article),
  delete: (id: string) => del(STORES.ARTICLES, id),
  getByFeed: (feedId: string) => getByIndex<Article>(STORES.ARTICLES, 'feedId', feedId),
  getUnread: () => getByIndex<Article>(STORES.ARTICLES, 'read', false),
  getStarred: () => getByIndex<Article>(STORES.ARTICLES, 'starred', true),
  getByDateRange: (from: number, to: number) =>
    getByRange<Article>(STORES.ARTICLES, 'pubDate', from, to),
  bulkPut: (articles: Article[]) => bulkPut(STORES.ARTICLES, articles),
  count: () => count(STORES.ARTICLES),
};

/**
 * Feeds API
 */
export const feeds = {
  get: (id: string) => get<Feed>(STORES.FEEDS, id),
  getAll: () => getAll<Feed>(STORES.FEEDS),
  put: (feed: Feed) => put(STORES.FEEDS, feed),
  delete: (id: string) => del(STORES.FEEDS, id),
  getByFolder: (folderId: string) => getByIndex<Feed>(STORES.FEEDS, 'folderId', folderId),
  getEnabled: () => getByIndex<Feed>(STORES.FEEDS, 'enabled', true),
  count: () => count(STORES.FEEDS),
};

/**
 * Folders API
 */
export const folders = {
  get: (id: string) => get<Folder>(STORES.FOLDERS, id),
  getAll: () => getAll<Folder>(STORES.FOLDERS),
  put: (folder: Folder) => put(STORES.FOLDERS, folder),
  delete: (id: string) => del(STORES.FOLDERS, id),
  getByParent: (parentId: string) => getByIndex<Folder>(STORES.FOLDERS, 'parentId', parentId),
  getRoots: () => getByIndex<Folder>(STORES.FOLDERS, 'parentId', ''),
  count: () => count(STORES.FOLDERS),
};

/**
 * Reading History API
 */
export const readingHistory = {
  get: (id: string) => get<ReadingHistoryEntry>(STORES.READING_HISTORY, id),
  getAll: () => getAll<ReadingHistoryEntry>(STORES.READING_HISTORY),
  put: (entry: ReadingHistoryEntry) => put(STORES.READING_HISTORY, entry),
  delete: (id: string) => del(STORES.READING_HISTORY, id),
  getByArticle: (articleId: string) =>
    getByIndex<ReadingHistoryEntry>(STORES.READING_HISTORY, 'articleId', articleId),
  getRecent: (from: number) =>
    getByRange<ReadingHistoryEntry>(STORES.READING_HISTORY, 'timestamp', from),
  count: () => count(STORES.READING_HISTORY),
};

/**
 * Annotations API
 */
export const annotations = {
  get: (id: string) => get<Annotation>(STORES.ANNOTATIONS, id),
  getAll: () => getAll<Annotation>(STORES.ANNOTATIONS),
  put: (annotation: Annotation) => put(STORES.ANNOTATIONS, annotation),
  delete: (id: string) => del(STORES.ANNOTATIONS, id),
  getByArticle: (articleId: string) =>
    getByIndex<Annotation>(STORES.ANNOTATIONS, 'articleId', articleId),
  getByType: (type: Annotation['type']) =>
    getByIndex<Annotation>(STORES.ANNOTATIONS, 'type', type),
  count: () => count(STORES.ANNOTATIONS),
};

/**
 * Search Index API
 */
export const searchIndex = {
  get: (term: string) => get<SearchIndexEntry>(STORES.SEARCH_INDEX, term),
  getAll: () => getAll<SearchIndexEntry>(STORES.SEARCH_INDEX),
  put: (entry: SearchIndexEntry) => put(STORES.SEARCH_INDEX, entry),
  delete: (term: string) => del(STORES.SEARCH_INDEX, term),
  clear: () => clear(STORES.SEARCH_INDEX),
};

/**
 * Preferences API
 */
export const preferences = {
  async get(): Promise<Preferences> {
    const prefs = await get<Preferences>(STORES.PREFERENCES, 'user_prefs');
    return prefs || DEFAULT_PREFERENCES;
  },
  put: (prefs: Preferences) => put(STORES.PREFERENCES, prefs),
  async update(updates: Partial<Preferences>): Promise<void> {
    const current = await preferences.get();
    await put(STORES.PREFERENCES, { ...current, ...updates, updatedAt: Date.now() });
  },
};

/**
 * Sync Queue API
 */
export const syncQueue = {
  get: (id: string) => get<SyncQueueItem>(STORES.SYNC_QUEUE, id),
  getAll: () => getAll<SyncQueueItem>(STORES.SYNC_QUEUE),
  put: (item: SyncQueueItem) => put(STORES.SYNC_QUEUE, item),
  delete: (id: string) => del(STORES.SYNC_QUEUE, id),
  getPending: () => getByIndex<SyncQueueItem>(STORES.SYNC_QUEUE, 'synced', false),
  clear: () => clear(STORES.SYNC_QUEUE),
};

/**
 * Initialize database and preferences
 */
export async function initializeDB(): Promise<void> {
  await openDB();

  // Ensure default preferences exist
  const prefs = await preferences.get();
  if (!prefs.id) {
    await preferences.put(DEFAULT_PREFERENCES);
  }
}

/**
 * Export all database utilities
 */
export {
  STORES,
  type Article,
  type Feed,
  type Folder,
  type ReadingHistoryEntry,
  type Annotation,
  type SearchIndexEntry,
  type Preferences,
  type SyncQueueItem,
} from './schema';
