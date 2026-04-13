"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AggregateFeedPost, AggregateFeedPostsResponse } from "@/lib/feed-posts";
import type { NormalizedArticle, ReaderTimelineMeta } from "@/lib/reader-types";

type ReaderTimelineStream = "sample" | "all";

type ReaderTimelineOptions = {
  enabled?: boolean;
  limit?: number;
  perFeedLimit?: number;
  stream?: ReaderTimelineStream;
  cursor?: number;
};

type ReaderTimelinePageResponse = AggregateFeedPostsResponse & {
  cursor?: number;
  next_cursor?: number | null;
  total_matched_posts?: number;
  applied_query?: string | null;
  applied_sort?: string;
  applied_stream?: string | null;
};

function normalizeArticle(post: AggregateFeedPost): NormalizedArticle {
  const articleId = `${post.feedId}:${post.id}`;

  let read = false;
  let starred = false;
  let archived = false;
  let bookmarked = false;

  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    try {
      const stored = window.localStorage.getItem(`aiwebfeeds.reader.article.${articleId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        read = parsed.read ?? false;
        starred = parsed.starred ?? false;
        archived = parsed.archived ?? false;
        bookmarked = parsed.bookmarked ?? false;
      }
    } catch {
      // ignore
    }
  }

  return {
    id: articleId,
    feedId: post.feedId,
    feedTitle: post.feedTitle,
    sourceUrl: post.sourceUrl,
    title: post.title,
    link: post.link,
    summary: post.summary,
    author: post.author,
    categories: post.categories,
    publishedAt: post.publishedAt,
    publishedAtMs: post.publishedAt ? Date.parse(post.publishedAt) : null,
    read,
    starred,
    archived,
    bookmarked,
  };
}

function toQueryString(
  feedIds: string[],
  limit: number,
  perFeedLimit: number,
  stream: ReaderTimelineStream,
  cursor: number,
  refresh: boolean,
): string {
  const params = new URLSearchParams();
  for (const feedId of feedIds) {
    params.append("feed", feedId);
  }
  params.set("limit", String(limit));
  params.set("per_feed_limit", String(perFeedLimit));
  params.set("stream", stream);
  if (stream === "all" && cursor > 0) {
    params.set("cursor", String(cursor));
  }
  if (refresh) {
    params.set("refresh", "true");
  }
  return params.toString();
}

export function useReaderTimeline(feedIds: string[], options: ReaderTimelineOptions = {}) {
  const { enabled = true, limit = 24, perFeedLimit = 3, stream = "sample", cursor = 0 } = options;

  const normalizedFeedIds = useMemo(
    () => Array.from(new Set(feedIds.filter((feedId) => feedId.trim().length > 0))),
    [feedIds],
  );

  const [articles, setArticles] = useState<NormalizedArticle[]>([]);
  const [meta, setMeta] = useState<ReaderTimelineMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(stream === "all" ? cursor : null);
  const generationRef = useRef(0);
  const activeControllerRef = useRef<AbortController | null>(null);
  const lastAppliedRefreshCountRef = useRef(0);

  const refresh = useCallback(() => {
    setRefreshCount((current) => current + 1);
  }, []);

  const fetchPage = useCallback(
    async (pageCursor: number, signal: AbortSignal, refresh: boolean) => {
      const response = await fetch(
        `/api/feeds/posts/aggregate?${toQueryString(
          normalizedFeedIds,
          limit,
          perFeedLimit,
          stream,
          pageCursor,
          refresh,
        )}`,
        {
          signal,
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to load reader timeline");
      }

      const payload = (await response.json()) as ReaderTimelinePageResponse;
      return {
        articles: payload.posts.map(normalizeArticle),
        meta: {
          cacheState: payload.cacheState,
          fetchedAt: payload.fetchedAt,
          expiresAt: payload.expiresAt,
          totalSources: payload.totalSources,
          successfulSources: payload.successfulSources,
          failedSources: payload.failedSources,
        },
        nextCursor: stream === "all" ? payload.next_cursor ?? null : null,
      };
    },
    [limit, normalizedFeedIds, perFeedLimit, stream],
  );

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    const controller = new AbortController();
    const shouldRefresh = refreshCount > lastAppliedRefreshCountRef.current;
    lastAppliedRefreshCountRef.current = refreshCount;
    activeControllerRef.current?.abort();
    activeControllerRef.current = controller;

    if (!enabled || normalizedFeedIds.length === 0) {
      setArticles([]);
      setMeta(null);
      setLoading(false);
      setLoadingMore(false);
      setNextCursor(null);
      setError(null);
      activeControllerRef.current?.abort();
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
      return;
    }

    setArticles([]);
    setMeta(null);
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setNextCursor(stream === "all" ? cursor : null);

    void fetchPage(stream === "all" ? cursor : 0, controller.signal, shouldRefresh)
      .then((payload) => {
        if (controller.signal.aborted || generation !== generationRef.current) {
          return;
        }

        setArticles(payload.articles);
        setMeta(payload.meta);
        setNextCursor(payload.nextCursor);
      })
      .catch((nextError) => {
        if (controller.signal.aborted || generation !== generationRef.current) {
          return;
        }

        setArticles([]);
        setMeta(null);
        setError(
          nextError instanceof Error ? nextError : new Error("Failed to load reader timeline"),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted && generation === generationRef.current) {
          setLoading(false);
          setLoadingMore(false);
          if (activeControllerRef.current === controller) {
            activeControllerRef.current = null;
          }
        }
      });

    return () => {
      controller.abort();
      activeControllerRef.current?.abort();
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
    };
  }, [cursor, enabled, fetchPage, normalizedFeedIds, refreshCount, stream]);

  const loadMore = useCallback(async () => {
    if (stream !== "all" || loading || loadingMore || nextCursor === null || !enabled) {
      return;
    }

    const pageCursor = nextCursor;
    const controller = new AbortController();
    activeControllerRef.current?.abort();
    activeControllerRef.current = controller;
    generationRef.current += 1;
    const generation = generationRef.current;

    setLoadingMore(true);
    setError(null);

    try {
      const payload = await fetchPage(pageCursor, controller.signal, false);

      if (controller.signal.aborted || generation !== generationRef.current) {
        return;
      }

      setArticles((current) => [...current, ...payload.articles]);
      setMeta(payload.meta);
      setNextCursor(payload.nextCursor);
    } catch (nextError) {
      if (controller.signal.aborted || generation !== generationRef.current) {
        return;
      }

      setError(
        nextError instanceof Error ? nextError : new Error("Failed to load reader timeline"),
      );
    } finally {
      if (!controller.signal.aborted && generation === generationRef.current) {
        setLoadingMore(false);
        if (activeControllerRef.current === controller) {
          activeControllerRef.current = null;
        }
      }
    }
  }, [enabled, fetchPage, loading, loadingMore, nextCursor, stream]);

  return {
    articles,
    meta,
    loading,
    loadingMore,
    error,
    hasMore: stream === "all" && nextCursor !== null,
    loadMore,
    refresh,
  };
}
