"use client";

/**
 * Reader Data Platform — useArticleState hook
 *
 * Manages device-local read / starred / archived / bookmarked state
 * for a single article. All I/O goes through IndexedDB; no network
 * requests are made.
 *
 * Usage:
 * ```tsx
 * const { state, markRead, toggleStar, toggleArchive, toggleBookmark } =
 *   useArticleState(article.id, article);
 * ```
 */

import { useCallback, useEffect, useState } from "react";

import {
  getOrDefaultArticleState,
  markRead as markReadIDB,
  markUnread as markUnreadIDB,
  subscribeToReaderLocalState,
  toggleArchive as toggleArchiveIDB,
  toggleBookmark as toggleBookmarkIDB,
  toggleStar as toggleStarIDB,
} from "@/lib/reader-local-state";
import { DEFAULT_LOCAL_STATE } from "@/lib/reader-types";
import type { LocalArticleState, NormalizedArticle } from "@/lib/reader-types";

export interface UseArticleStateResult {
  /** Current device-local state for the article */
  state: LocalArticleState;
  /** True while the initial state is being read from IndexedDB */
  loading: boolean;
  markRead: () => Promise<void>;
  markUnread: () => Promise<void>;
  toggleStar: () => Promise<void>;
  toggleArchive: () => Promise<void>;
  toggleBookmark: () => Promise<void>;
}

/**
 * @param articleId  Unique article identifier.
 * @param context    Full NormalizedArticle; used to seed an IndexedDB record on
 *                   first mutation. Pass it whenever the article data is available.
 */
export function useArticleState(
  articleId: string,
  context?: NormalizedArticle,
): UseArticleStateResult {
  const [state, setState] = useState<LocalArticleState>({ ...DEFAULT_LOCAL_STATE });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getOrDefaultArticleState(articleId)
      .then((s) => {
        if (!cancelled) setState(s);
      })
      .catch(() => {
        if (!cancelled) setState({ ...DEFAULT_LOCAL_STATE });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [articleId]);

  useEffect(() => {
    return subscribeToReaderLocalState(({ articleId: changedArticleId, state: nextState }) => {
      if (changedArticleId === articleId) {
        setState(nextState);
      }
    });
  }, [articleId]);

  const markRead = useCallback(async () => {
    await markReadIDB(articleId, context);
  }, [articleId, context]);

  const markUnread = useCallback(async () => {
    await markUnreadIDB(articleId, context);
  }, [articleId, context]);

  const toggleStar = useCallback(async () => {
    await toggleStarIDB(articleId, context);
  }, [articleId, context]);

  const toggleArchive = useCallback(async () => {
    await toggleArchiveIDB(articleId, context);
  }, [articleId, context]);

  const toggleBookmark = useCallback(async () => {
    await toggleBookmarkIDB(articleId, context);
  }, [articleId, context]);

  return { state, loading, markRead, markUnread, toggleStar, toggleArchive, toggleBookmark };
}
