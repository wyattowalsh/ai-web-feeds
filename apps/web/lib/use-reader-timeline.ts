"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AggregateFeedPost, AggregateFeedPostsResponse } from "@/lib/feed-posts";
import type { NormalizedArticle, ReaderTimelineMeta } from "@/lib/reader-types";

type ReaderTimelineOptions = {
  enabled?: boolean;
  limit?: number;
  perFeedLimit?: number;
};

function normalizeArticle(post: AggregateFeedPost): NormalizedArticle {
  return {
    id: `${post.feedId}:${post.id}`,
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
    read: false,
    starred: false,
    archived: false,
    bookmarked: false,
  };
}

function toQueryString(
  feedIds: string[],
  limit: number,
  perFeedLimit: number,
  refresh: boolean,
): string {
  const params = new URLSearchParams();
  for (const feedId of feedIds) {
    params.append("feed", feedId);
  }
  params.set("limit", String(limit));
  params.set("per_feed_limit", String(perFeedLimit));
  if (refresh) {
    params.set("refresh", "true");
  }
  return params.toString();
}

export function useReaderTimeline(feedIds: string[], options: ReaderTimelineOptions = {}) {
  const { enabled = true, limit = 24, perFeedLimit = 3 } = options;

  const normalizedFeedIds = useMemo(
    () => Array.from(new Set(feedIds.filter((feedId) => feedId.trim().length > 0))),
    [feedIds],
  );

  const [articles, setArticles] = useState<NormalizedArticle[]>([]);
  const [meta, setMeta] = useState<ReaderTimelineMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const refresh = useCallback(() => {
    setRefreshCount((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled || normalizedFeedIds.length === 0) {
      setArticles([]);
      setMeta(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const shouldRefresh = refreshCount > 0;

    setLoading(true);
    setError(null);

    void fetch(
      `/api/feeds/posts/aggregate?${toQueryString(
        normalizedFeedIds,
        limit,
        perFeedLimit,
        shouldRefresh,
      )}`,
      {
        signal: controller.signal,
        cache: "no-store",
      },
    )
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Failed to load reader timeline");
        }

        return response.json() as Promise<AggregateFeedPostsResponse>;
      })
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }

        setArticles(payload.posts.map(normalizeArticle));
        setMeta({
          cacheState: payload.cacheState,
          fetchedAt: payload.fetchedAt,
          expiresAt: payload.expiresAt,
          totalSources: payload.totalSources,
          successfulSources: payload.successfulSources,
          failedSources: payload.failedSources,
        });
      })
      .catch((nextError) => {
        if (controller.signal.aborted) {
          return;
        }

        setArticles([]);
        setMeta(null);
        setError(
          nextError instanceof Error ? nextError : new Error("Failed to load reader timeline"),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [enabled, limit, normalizedFeedIds, perFeedLimit, refreshCount]);

  return {
    articles,
    meta,
    loading,
    error,
    refresh,
  };
}
