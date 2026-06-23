/**
 * Offline Sync Manager
 *
 * Manages offline operations and conflict resolution using raw IndexedDB
 * via lib/db (no Dexie). Provides queuing for read/star/save changes and
 * conflict rules where local changes take precedence.
 *
 * Stores used:
 *  - articles: canonical cached content + read/starred/archived flags
 *  - syncQueue: pending offline operations to reconcile
 */

import {
  articles,
  syncQueue,
  type Article,
  type SyncQueueItem,
} from "@/lib/db";

export type OfflineOperationType = "read" | "star" | "archive" | "tag" | "annotation" | "save";

export interface OfflineOperationInput {
  type: OfflineOperationType;
  articleId: string;
  data?: Record<string, unknown>;
}

export interface QueuedOperation extends SyncQueueItem {}

export interface ConflictInfo {
  articleId: string;
  localChange: QueuedOperation;
  currentArticle: Article | undefined;
  reason: string;
}

export interface SyncResult {
  applied: number;
  conflicts: ConflictInfo[];
  errors: Array<{ articleId: string; error: string }>;
}

/**
 * Generate a unique operation id.
 */
function generateId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Queue an offline operation. Creates a SyncQueueItem with synced=false.
 * Subsequent calls for the same article/type will overwrite the pending item
 * (latest local intent wins within the queue).
 */
export async function queueOperation(input: OfflineOperationInput): Promise<QueuedOperation> {
  const item: SyncQueueItem = {
    id: generateId(),
    type: input.type as SyncQueueItem["type"],
    articleId: input.articleId,
    data: input.data ?? {},
    timestamp: Date.now(),
    synced: false,
  };

  // For read/star/archive we collapse duplicates by removing prior pending of same type
  if (["read", "star", "archive"].includes(input.type)) {
    try {
      const pending = await syncQueue.getPending();
      for (const p of pending) {
        if (p.articleId === input.articleId && p.type === input.type && !p.synced) {
          await syncQueue.delete(p.id);
        }
      }
    } catch {
      // Non-fatal: proceed to insert
    }
  }

  await syncQueue.put(item);
  return item as QueuedOperation;
}

/**
 * Convenience: queue a save-for-offline intent (stores article if provided).
 * If an Article payload is supplied in data.article, it will be upserted.
 */
export async function queueSaveForOffline(article?: Article): Promise<QueuedOperation | null> {
  if (article) {
    const toStore: Article = {
      ...article,
      cachedAt: Date.now(),
      lastModified: Date.now(),
    };
    await articles.put(toStore);
  }
  return queueOperation({
    type: "save",
    articleId: article?.id ?? `save_${Date.now()}`,
    data: article ? { articleId: article.id } : {},
  });
}

/**
 * Convenience: queue a read toggle.
 */
export async function queueMarkRead(articleId: string, read: boolean): Promise<QueuedOperation> {
  return queueOperation({ type: "read", articleId, data: { read } });
}

/**
 * Convenience: queue a star toggle.
 */
export async function queueMarkStar(articleId: string, starred: boolean): Promise<QueuedOperation> {
  return queueOperation({ type: "star", articleId, data: { starred } });
}

/**
 * Get all pending (unsynced) operations.
 */
export async function getPendingOperations(): Promise<QueuedOperation[]> {
  const items = await syncQueue.getPending();
  return items as QueuedOperation[];
}

/**
 * Clear a specific pending operation.
 */
export async function clearPendingOperation(id: string): Promise<void> {
  await syncQueue.delete(id);
}

/**
 * Clear all pending operations (e.g., after successful remote reconcile).
 */
export async function clearAllPending(): Promise<void> {
  await syncQueue.clear();
}

/**
 * Apply a single queued operation to the articles store (local wins).
 * This mutates the local Article if present; otherwise it is a no-op for content.
 */
async function applyOperation(op: QueuedOperation): Promise<void> {
  const existing = await articles.get(op.articleId);
  if (!existing) {
    // No local article record; record is metadata-only for now.
    // Create a minimal stub so flags persist for future content arrival.
    const stub: Article = {
      id: op.articleId,
      feedId: (op.data?.feedId as string) ?? "unknown",
      title: (op.data?.title as string) ?? "",
      link: (op.data?.link as string) ?? "",
      content: (op.data?.content as string) ?? "",
      pubDate: (op.data?.pubDate as number) ?? Date.now(),
      topics: (op.data?.topics as string[]) ?? [],
      rawCategories: (op.data?.rawCategories as string[]) ?? [],
      sourceTopics: (op.data?.sourceTopics as string[]) ?? [],
      enclosures: (op.data?.enclosures as Article["enclosures"]) ?? [],
      read: false,
      starred: false,
      archived: false,
      tags: (op.data?.tags as string[]) ?? [],
      cachedAt: Date.now(),
      lastModified: Date.now(),
    };
    // Apply op flags
    if (op.type === "read" && typeof op.data?.read === "boolean") stub.read = op.data.read;
    if (op.type === "star" && typeof op.data?.starred === "boolean") stub.starred = op.data.starred;
    if (op.type === "archive" && typeof op.data?.archived === "boolean")
      stub.archived = op.data.archived;
    await articles.put(stub);
    return;
  }

  const patch: Partial<Article> = { lastModified: Date.now() };

  switch (op.type) {
    case "read":
      if (typeof op.data?.read === "boolean") patch.read = op.data.read;
      break;
    case "star":
      if (typeof op.data?.starred === "boolean") patch.starred = op.data.starred;
      break;
    case "archive":
      if (typeof op.data?.archived === "boolean") patch.archived = op.data.archived;
      break;
    case "tag":
      if (Array.isArray(op.data?.tags)) patch.tags = op.data.tags as string[];
      break;
    case "save":
      // Ensure cached timestamp reflects explicit offline save
      patch.cachedAt = Date.now();
      break;
    default:
      // annotation handled elsewhere
      break;
  }

  if (Object.keys(patch).length > 1) {
    await articles.put({ ...existing, ...patch });
  }
}

/**
 * Reconcile pending operations against current local state.
 *
 * Conflict rule (per spec): Local changes always take precedence.
 * We detect a "conflict" when a pending op exists for an article that also
 * has a different remote-derived value in the current Article record.
 * We still apply the local op (local wins) and surface the conflict info.
 */
export async function reconcilePending(): Promise<SyncResult> {
  const pending = await getPendingOperations();
  const result: SyncResult = { applied: 0, conflicts: [], errors: [] };

  for (const op of pending) {
    try {
      const current = await articles.get(op.articleId);

      // Detect simple conflict signals for read/star
      let conflicted = false;
      let reason = "";

      if (current) {
        if (op.type === "read" && typeof op.data?.read === "boolean") {
          // If current differs and was modified more recently than op, flag conflict
          if (current.read !== op.data.read && current.lastModified > op.timestamp) {
            conflicted = true;
            reason = "read state diverged after local change";
          }
        }
        if (op.type === "star" && typeof op.data?.starred === "boolean") {
          if (current.starred !== op.data.starred && current.lastModified > op.timestamp) {
            conflicted = true;
            reason = "star state diverged after local change";
          }
        }
      }

      await applyOperation(op);

      // Mark as synced
      await syncQueue.put({ ...op, synced: true });

      result.applied += 1;

      if (conflicted) {
        result.conflicts.push({
          articleId: op.articleId,
          localChange: op,
          currentArticle: current,
          reason,
        });
      }
    } catch (e) {
      result.errors.push({
        articleId: op.articleId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}

/**
 * Ensure an article is present for offline use. If not present and a fetcher
 * is provided, attempt to fetch and store. Returns the stored article or null.
 */
export async function ensureArticleCached(
  articleId: string,
  fetcher?: (id: string) => Promise<Article | null>,
): Promise<Article | null> {
  const existing = await articles.get(articleId);
  if (existing) return existing;

  if (!fetcher) return null;

  try {
    const fetched = await fetcher(articleId);
    if (fetched) {
      const toStore: Article = { ...fetched, cachedAt: Date.now(), lastModified: Date.now() };
      await articles.put(toStore);
      return toStore;
    }
  } catch {
    // Swallow fetch errors; caller can retry later
  }
  return null;
}

/**
 * Get cached articles (simple helper for offline views).
 */
export async function getCachedArticles(): Promise<Article[]> {
  return articles.getAll();
}

/**
 * Background sync integration hook for Service Worker.
 * In the SW context, this can be called during a 'sync' event.
 * Here it performs local reconciliation of pending flags.
 */
export async function processBackgroundSync(): Promise<SyncResult> {
  // In a full implementation the SW would coordinate with main thread
  // via postMessage to access full article content. For now we reconcile
  // local flag state and surface results for the main thread to handle.
  return reconcilePending();
}

export const offlineSync = {
  queueOperation,
  queueSaveForOffline,
  queueMarkRead,
  queueMarkStar,
  getPendingOperations,
  clearPendingOperation,
  clearAllPending,
  reconcilePending,
  ensureArticleCached,
  getCachedArticles,
  processBackgroundSync,
};

export default offlineSync;
