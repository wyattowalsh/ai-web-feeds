"use client";

/**
 * Reader Data Platform — useReaderTimeline hook
 *
 * Fetches a merged timeline from /api/feeds/posts/aggregate and enriches
 * each article with device-local read / star / archive / bookmark state
 * from IndexedDB.
 *
 * Usage:
 * ```tsx
 * const { articles, meta, loading, error, refresh } = useReaderTimeline(feedIds);
 * ```
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  enrichArticlesWithLocalState,
  subscribeToReaderLocalState,
} from "@/lib/reader-local-state";
import { fetchTimeline, sortTimelineArticles } from "@/lib/reader-service";
import type { NormalizedArticle, TimelineFetchOptions, TimelineResult } from "@/lib/reader-types";

export type TimelineMeta = Omit<TimelineResult, "articles">;

export interface UseReaderTimelineOptions extends Omit<TimelineFetchOptions, "feedIds"> {
  /** When false the initial fetch is skipped (useful while feedIds aren't ready). */
  enabled?: boolean;
}

export interface UseReaderTimelineResult {
  articles: NormalizedArticle[];
  meta: TimelineMeta | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useReaderTimeline(
  feedIds: string[],
  options: UseReaderTimelineOptions = {},
): UseReaderTimelineResult {
  const { enabled = true, forceRefresh = false, limit, perFeedLimit } = options;
  const normalizedFeedIds = Array.from(
    new Set(feedIds.map((feedId) => feedId.trim()).filter((feedId) => feedId.length > 0)),
  ).sort();

  const [articles, setArticles] = useState<NormalizedArticle[]>([]);
  const [meta, setMeta] = useState<TimelineMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // stable key so the effect only re-runs when the feed list actually changes
  const feedKey = normalizedFeedIds.join(",");

  const load = useCallback(
    async (forceRefresh: boolean) => {
      if (normalizedFeedIds.length === 0) {
        setArticles([]);
        setMeta(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await fetchTimeline({
          feedIds: normalizedFeedIds,
          limit,
          perFeedLimit,
          forceRefresh,
        });
        const enriched = await enrichArticlesWithLocalState(result.articles);
        setArticles(sortTimelineArticles(enriched));
        setMeta({
          fetchedAt: result.fetchedAt,
          expiresAt: result.expiresAt,
          cacheState: result.cacheState,
          totalSources: result.totalSources,
          successfulSources: result.successfulSources,
          failedSources: result.failedSources,
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to load timeline"));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [feedKey, limit, perFeedLimit],
  );

  // Ref so the refresh callback always calls the latest load without stale closure
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled || normalizedFeedIds.length === 0) {
      setArticles([]);
      setMeta(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (enabled && normalizedFeedIds.length > 0) {
      void load(forceRefresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, feedKey, forceRefresh, limit, perFeedLimit]);

  useEffect(() => {
    return subscribeToReaderLocalState(({ articleId, state }) => {
      setArticles((current) => {
        const index = current.findIndex((article) => article.id === articleId);
        if (index < 0) {
          return current;
        }

        const next = [...current];
        next[index] = {
          ...next[index],
          ...state,
        };
        return sortTimelineArticles(next);
      });
    });
  }, []);

  useEffect(() => {
    if (!enabled || !meta?.expiresAt || normalizedFeedIds.length === 0) {
      return;
    }

    const expiresAtMs = Date.parse(meta.expiresAt);
    if (Number.isNaN(expiresAtMs)) {
      return;
    }

    if (expiresAtMs <= Date.now()) {
      void loadRef.current(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadRef.current(true);
    }, expiresAtMs - Date.now());

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [enabled, feedKey, meta?.expiresAt, normalizedFeedIds.length]);

  const refresh = useCallback(() => void loadRef.current(true), []);

  return { articles, meta, loading, error, refresh };
}
