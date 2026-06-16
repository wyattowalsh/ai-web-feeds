"use client";

import { useCallback, useState } from "react";

import type { FeedSource } from "@/lib/feeds-filters";
import {
  compareByPublishedDesc,
  LIVE_BOOTSTRAP_PER_FEED_LIMIT,
  LIVE_BOOTSTRAP_POST_LIMIT,
  LIVE_REFRESH_SAMPLE_FEED_LIMIT,
  normalizeLiveArticle,
  type ArticleSort,
  type LiveStreamEvent,
  type LiveStreamProgress,
  type WorkspaceArticle,
} from "@/lib/reader";

export interface UseReaderLiveRefreshParams {
  candidateFeeds: FeedSource[];
  feedIds: string[];
  query: string;
  sort: ArticleSort;
  mergedArticles: WorkspaceArticle[];
}

export interface UseReaderLiveRefreshResult {
  refreshing: boolean;
  refreshError: string | null;
  liveProgress: LiveStreamProgress | null;
  overlayArticles: WorkspaceArticle[];
  setOverlayArticles: React.Dispatch<React.SetStateAction<WorkspaceArticle[]>>;
  refreshLatest: (forceRefresh?: boolean) => Promise<void>;
}

/**
 * Hook extracted from feeds-workspace-client for live refresh streaming.
 *
 * Owns the refresh state and performs the POST to /api/feeds/posts/aggregate/stream,
 * parsing NDJSON stream events (or JSON fallback) to merge new live articles into overlay.
 *
 * All stream parsing / dedup / limit logic is preserved verbatim in behavior.
 */
export function useReaderLiveRefresh(
  params: UseReaderLiveRefreshParams,
): UseReaderLiveRefreshResult {
  const { candidateFeeds, feedIds: providedFeedIds, query, sort, mergedArticles } = params;

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [liveProgress, setLiveProgress] = useState<LiveStreamProgress | null>(null);
  const [overlayArticles, setOverlayArticles] = useState<WorkspaceArticle[]>([]);

  const refreshLatest = useCallback(
    async (forceRefresh = true) => {
      const feedIds =
        providedFeedIds.length > 0
          ? providedFeedIds
          : candidateFeeds
              .slice(0, LIVE_REFRESH_SAMPLE_FEED_LIMIT)
              .map((feed) => feed.id ?? "")
              .filter(Boolean);

      if (feedIds.length === 0) {
        setRefreshError("Choose at least one source to refresh.");
        return;
      }

      setRefreshing(true);
      setRefreshError(null);
      setLiveProgress({
        totalSources: feedIds.length,
        successfulSources: 0,
        failedSources: 0,
        completed: false,
      });

      try {
        const response = await fetch("/api/feeds/posts/aggregate/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            feedIds,
            limit: LIVE_BOOTSTRAP_POST_LIMIT,
            perFeedLimit: LIVE_BOOTSTRAP_PER_FEED_LIMIT,
            refresh: forceRefresh,
            q: query || null,
            sort,
          }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Failed to refresh latest posts");
        }

        const existingKeys = new Set(
          mergedArticles.map((article) => article.id || `${article.feed_id}:${article.link}`),
        );
        const reader = response.body?.getReader();
        if (!reader) {
          const payload = (await response.json()) as {
            posts?: Array<Parameters<typeof normalizeLiveArticle>[0]>;
          };
          const normalizedPosts = (payload.posts ?? []).map(normalizeLiveArticle);
          setOverlayArticles((currentOverlay) =>
            [...normalizedPosts, ...currentOverlay]
              .sort(compareByPublishedDesc)
              .slice(0, LIVE_BOOTSTRAP_POST_LIMIT),
          );
          setLiveProgress((current) => ({
            totalSources: current?.totalSources ?? feedIds.length,
            successfulSources: current?.totalSources ?? feedIds.length,
            failedSources: 0,
            completed: true,
          }));
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let malformedEventCount = 0;

        const handleEvent = (event: LiveStreamEvent) => {
          if (event.type === "start") {
            setLiveProgress({
              totalSources: event.totalSources,
              successfulSources: 0,
              failedSources: 0,
              completed: false,
            });
            return;
          }

          if (event.type === "feed_error") {
            setLiveProgress((current) => ({
              totalSources: current?.totalSources ?? feedIds.length,
              successfulSources: event.successfulSources,
              failedSources: event.failedSources,
              completed: false,
            }));
            return;
          }

          if (event.type === "feed") {
            setLiveProgress((current) => ({
              totalSources: current?.totalSources ?? feedIds.length,
              successfulSources: event.successfulSources,
              failedSources: event.failedSources,
              completed: false,
            }));

            const normalizedPosts = event.posts.map(normalizeLiveArticle);
            setOverlayArticles((currentOverlay) => {
              const keys = new Set([
                ...existingKeys,
                ...currentOverlay.map(
                  (article) => article.id || `${article.feed_id}:${article.link}`,
                ),
              ]);
              const nextPosts = normalizedPosts.filter((article) => {
                const key = article.id || `${article.feed_id}:${article.link}`;
                if (keys.has(key)) {
                  return false;
                }
                keys.add(key);
                return true;
              });

              return [...nextPosts, ...currentOverlay]
                .sort(compareByPublishedDesc)
                .slice(0, LIVE_BOOTSTRAP_POST_LIMIT);
            });
            return;
          }

          if (event.type === "done") {
            setLiveProgress({
              totalSources: event.totalSources,
              successfulSources: event.successfulSources,
              failedSources: event.failedSources,
              completed: true,
            });
            return;
          }

          if (event.type === "error") {
            throw new Error(event.message);
          }
        };
        const handleEventLine = (line: string) => {
          if (!line.trim()) {
            return;
          }

          let event: LiveStreamEvent;
          try {
            event = JSON.parse(line) as LiveStreamEvent;
          } catch {
            malformedEventCount += 1;
            return;
          }

          handleEvent(event);
        };

        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            handleEventLine(line);
          }

          if (done) {
            break;
          }
        }

        if (buffer.trim()) {
          handleEventLine(buffer);
        }

        if (malformedEventCount > 0) {
          setRefreshError(
            malformedEventCount === 1
              ? "Skipped a malformed refresh event; kept loaded posts."
              : `Skipped ${malformedEventCount} malformed refresh events; kept loaded posts.`,
          );
        }
      } catch (nextError) {
        setRefreshError(
          nextError instanceof Error ? nextError.message : "Failed to refresh latest posts",
        );
      } finally {
        setRefreshing(false);
      }
    },
    [candidateFeeds, providedFeedIds, query, sort, mergedArticles],
  );

  return {
    refreshing,
    refreshError,
    liveProgress,
    overlayArticles,
    setOverlayArticles,
    refreshLatest,
  };
}
