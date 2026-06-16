/**
 * Hydrate Article States
 *
 * Migrate localStorage article states (read/starred/archived/bookmarked)
 * to IndexedDB using the existing lib/db APIs (preferences + articles stores).
 *
 * This enables the reader to persist article triage state in IndexedDB
 * instead of (or in addition to) localStorage, for offline durability
 * and future multi-device sync potential.
 */

import { ARTICLE_STATE_STORAGE_PREFIX, DEFAULT_ARTICLE_STATE } from "./constants";
import type { ReaderArticleState } from "./types";

import { articleStateStorageKey, canUseStorage, readArticleState } from "./article-state";

import { articles, preferences as preferencesStore, type Preferences } from "@/lib/db";

// Extended preferences shape that can carry article states without changing schema
type PreferencesWithArticleStates = Preferences & {
  articleStates?: Record<string, ReaderArticleState>;
};

/**
 * Scan localStorage for all article states under the known prefix.
 * Returns a map of articleId -> ReaderArticleState.
 */
export function scanLocalStorageArticleStates(): Record<string, ReaderArticleState> {
  const result: Record<string, ReaderArticleState> = {};

  if (!canUseStorage()) {
    return result;
  }

  try {
    const prefix = ARTICLE_STATE_STORAGE_PREFIX;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;

      const articleId = key.slice(prefix.length);
      if (!articleId) continue;

      const state = readArticleState(articleId);
      // Only persist non-default states to avoid bloating storage
      const isDefault = !state.read && !state.starred && !state.archived && !state.bookmarked;
      if (!isDefault) {
        result[articleId] = state;
      }
    }
  } catch {
    // Ignore enumeration errors (private mode, quota, etc.)
  }

  return result;
}

/**
 * Load article states map from IndexedDB (stored in preferences.articleStates).
 */
export async function loadArticleStatesFromIDB(): Promise<Record<string, ReaderArticleState>> {
  try {
    const prefs = (await preferencesStore.get()) as PreferencesWithArticleStates;
    return prefs?.articleStates ? { ...prefs.articleStates } : {};
  } catch {
    return {};
  }
}

/**
 * Persist the full article states map into IndexedDB via preferences store.
 */
export async function saveArticleStatesToIDB(
  states: Record<string, ReaderArticleState>,
): Promise<void> {
  try {
    const current = (await preferencesStore.get()) as PreferencesWithArticleStates;
    const next: PreferencesWithArticleStates = {
      ...(current ?? ({} as Preferences)),
      id: "user_prefs",
      articleStates: { ...(current?.articleStates ?? {}), ...states },
      updatedAt: Date.now(),
    } as PreferencesWithArticleStates;

    await preferencesStore.put(next);
  } catch {
    // Non-fatal: states remain in localStorage as fallback
  }
}

/**
 * Sync a single article's state change into IndexedDB.
 * - Updates the in-preferences map for reader overlay state.
 * - If a corresponding full Article record exists in the articles store,
 *   opportunistically updates its read/starred/archived flags (bookmarked
 *   has no server-side analogue and is kept in the overlay map only).
 */
export async function syncArticleState(
  articleId: string,
  partial: Partial<ReaderArticleState>,
): Promise<void> {
  try {
    // Merge with any existing state from IDB
    const existingMap = await loadArticleStatesFromIDB();
    const prev = existingMap[articleId] ?? { ...DEFAULT_ARTICLE_STATE };
    const nextState: ReaderArticleState = { ...prev, ...partial };

    // Write back the map to preferences
    const current = (await preferencesStore.get()) as PreferencesWithArticleStates;
    const nextPrefs: PreferencesWithArticleStates = {
      ...(current ?? ({} as Preferences)),
      id: "user_prefs",
      articleStates: { ...(current?.articleStates ?? {}), [articleId]: nextState },
      updatedAt: Date.now(),
    } as PreferencesWithArticleStates;

    await preferencesStore.put(nextPrefs);

    // Opportunistically reflect into articles store when a record exists
    try {
      const existingArticle = await articles.get(articleId);
      if (existingArticle) {
        const patch: Partial<typeof existingArticle> = {};
        if (typeof nextState.read === "boolean") patch.read = nextState.read;
        if (typeof nextState.starred === "boolean") patch.starred = nextState.starred;
        if (typeof nextState.archived === "boolean") patch.archived = nextState.archived;
        if (Object.keys(patch).length > 0) {
          await articles.put({ ...existingArticle, ...patch, lastModified: Date.now() });
        }
      }
    } catch {
      // Articles store update is best-effort
    }
  } catch {
    // Swallow to keep UI responsive; localStorage write (caller) remains as fallback
  }
}

/**
 * Hydrate (migrate) article states from localStorage into IndexedDB.
 *
 * Steps:
 * 1. Scan localStorage for keys under ARTICLE_STATE_STORAGE_PREFIX.
 * 2. Merge discovered states into the IDB-backed map in preferences.
 * 3. Optionally clear the migrated localStorage keys (default: true).
 *
 * Returns a summary of the migration.
 */
export async function hydrateArticleStates(options?: { clearLocalStorage?: boolean }): Promise<{
  migratedCount: number;
  clearedCount: number;
  totalInIDB: number;
}> {
  const { clearLocalStorage = true } = options ?? {};

  const localStates = scanLocalStorageArticleStates();
  const migratedKeys = Object.keys(localStates);
  const migratedCount = migratedKeys.length;

  if (migratedCount > 0) {
    await saveArticleStatesToIDB(localStates);
  }

  // Re-load to compute total present in IDB after merge
  const idbStates = await loadArticleStatesFromIDB();
  const totalInIDB = Object.keys(idbStates).length;

  let clearedCount = 0;
  if (clearLocalStorage && canUseStorage()) {
    try {
      for (const articleId of migratedKeys) {
        try {
          window.localStorage.removeItem(articleStateStorageKey(articleId));
          clearedCount++;
        } catch {
          // Ignore individual removal errors
        }
      }
    } catch {
      // Ignore enumeration/storage errors during cleanup
    }
  }

  return {
    migratedCount,
    clearedCount,
    totalInIDB,
  };
}

export type { ReaderArticleState } from "./types";
