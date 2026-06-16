"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock3, Filter, Newspaper, RefreshCcw, SlidersHorizontal } from "lucide-react";

import { FeedCatalog } from "./feed-catalog";

import { cn } from "@/lib/cn";
import type { FeedSource } from "@/lib/feeds-filters";
import { getTopics } from "@/lib/feeds-filters";
import { CANONICAL_CATALOG_PATH, CANONICAL_READER_PATH } from "@/lib/reader-routes";
import { parseInitialState } from "@/lib/reader-route-parse";
import type {
  FeedsWorkspaceInitialBrowse,
  FeedsWorkspaceInitialState,
  FeedsWorkspaceMode,
} from "@/lib/reader-route-types";
import {
  compareByPublishedDesc,
  DEFAULT_ARTICLE_STATE,
  DEFAULT_PAGE_LIMIT,
  LIVE_BOOTSTRAP_PER_FEED_LIMIT,
  LIVE_BOOTSTRAP_POST_LIMIT,
  LIVE_REFRESH_SAMPLE_FEED_LIMIT,
  buildCurrentFilterChips,
  buildReaderHref,
  formatSnapshotTimestamp,
  getSourceTypesFromFeeds,
  matchesDraftState,
  matchesFeedSlice,
  matchesReaderView,
  normalizeArticle,
  normalizeCachedArticle,
  normalizeLiveArticle,
  normalizeQueryDraft,
  normalizeTopicsValue,
  readArticleState,
  toVerifiedDraftValue,
  writeArticleState,
  type FeedStats,
  type LiveStreamEvent,
  type LiveStreamProgress,
  type ReaderArticleState,
  type ReaderDraftState,
  type VerifiedDraftValue,
  type WorkspaceArticle,
} from "@/lib/reader";
import { ReaderArticleStream } from "@/components/reader/reader-article-stream";
import { ReaderCorpusEmpty } from "@/components/reader/reader-corpus-empty";
import { ReaderFiltersForm } from "@/components/reader/reader-filters-form";
import { ReaderPreviewPane } from "@/components/reader/reader-preview-pane";
import { ReaderShellHeader } from "@/components/reader/reader-shell-header";
import {
  hydrateArticleStates,
  loadArticleStatesFromIDB,
  syncArticleState,
} from "@/lib/reader/hydrate-article-state";
import { useLocalSearchIndex } from "@/hooks/use-local-search-index";
import { useReaderShortcuts } from "@/hooks/use-reader-shortcuts";
import { useReaderPreferences } from "@/lib/use-reader-preferences";

type FeedsWorkspaceClientProps = {
  mode: FeedsWorkspaceMode;
  feeds: FeedSource[];
  stats: FeedStats;
  initialState: FeedsWorkspaceInitialState;
  initialBrowse: FeedsWorkspaceInitialBrowse | null;
};

export function ReaderShell({
  feeds,
  stats,
  initialState,
  initialBrowse,
}: {
  feeds: FeedSource[];
  stats: FeedStats;
  initialState: FeedsWorkspaceInitialState;
  initialBrowse: FeedsWorkspaceInitialBrowse;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { preferences, update } = useReaderPreferences();
  const initialParamsString = useMemo(
    () =>
      buildReaderHref(
        {
          query: initialState.query,
          sourceType: initialState.sourceType,
          topics: initialState.topics,
          verified: initialState.verified,
          feedIds: initialState.feedIds,
          sort: initialState.sort,
          readerView: initialState.readerView,
          cursor: initialState.cursor,
        },
        {},
      ),
    [initialState],
  );

  const [queryDraft, setQueryDraft] = useState(initialState.query);
  const [sourceTypeDraft, setSourceTypeDraft] = useState(initialState.sourceType ?? "");
  const [topicsDraft, setTopicsDraft] = useState(initialState.topics);
  const [verifiedDraft, setVerifiedDraft] = useState<VerifiedDraftValue>(
    toVerifiedDraftValue(initialState.verified),
  );
  const [readerViewDraft, setReaderViewDraft] = useState(initialState.readerView);
  const [sortDraft, setSortDraft] = useState(initialState.sort);
  const [browse, setBrowse] = useState(initialBrowse);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [liveProgress, setLiveProgress] = useState<LiveStreamProgress | null>(null);
  const [overlayArticles, setOverlayArticles] = useState<WorkspaceArticle[]>([]);
  const [cachedArticles, setCachedArticles] = useState<WorkspaceArticle[]>([]);
  const [articleStates, setArticleStates] = useState<Record<string, ReaderArticleState>>({});
  const { ready: localIndexReady, search: searchLocal } = useLocalSearchIndex();
  const [previewArticleId, setPreviewArticleId] = useState<string | null>(null);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const firstLoadRef = useRef(true);
  const queryInputRef = useRef<HTMLInputElement>(null);
  const searchParamsString = searchParams.toString();

  useEffect(() => {
    void (async () => {
      await hydrateArticleStates({ clearLocalStorage: false });
      // Minimal merge: load IDB states (post-migration) into local articleStates so
      // articleStateMap and filters see persisted triage from IDB (readArticleState remains LS fallback).
      try {
        const idb = await loadArticleStatesFromIDB();
        if (Object.keys(idb).length > 0) {
          setArticleStates((current) => ({ ...current, ...idb }));
        }
      } catch {
        // non-fatal
      }
    })();
  }, []);

  const currentState = useMemo<FeedsWorkspaceInitialState>(() => {
    const parsed = parseInitialState(searchParams);
    return {
      ...parsed,
      verified: stats.hasVerificationMetadata ? parsed.verified : null,
    };
  }, [searchParams, stats.hasVerificationMetadata]);

  useEffect(() => {
    setQueryDraft(currentState.query);
    setSourceTypeDraft(currentState.sourceType ?? "");
    setTopicsDraft(currentState.topics);
    setVerifiedDraft(toVerifiedDraftValue(currentState.verified));
    setReaderViewDraft(currentState.readerView);
    setSortDraft(currentState.sort);
  }, [
    currentState.query,
    currentState.readerView,
    currentState.sort,
    currentState.sourceType,
    currentState.topics,
    currentState.verified,
  ]);

  useEffect(() => {
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      const initialQuery = initialParamsString.split("?")[1] ?? "";
      if (searchParamsString === initialQuery) {
        return;
      }
    }

    const controller = new AbortController();
    const params = new URLSearchParams();
    if (currentState.query) {
      params.set("q", currentState.query);
    }
    if (currentState.sourceType) {
      params.set("source_type", currentState.sourceType);
    }
    if (currentState.topics.length > 0) {
      params.set("topics", normalizeTopicsValue(currentState.topics));
    }
    if (typeof currentState.verified === "boolean") {
      params.set("verified", String(currentState.verified));
    }
    if (currentState.sort !== "latest") {
      params.set("sort", currentState.sort);
    }
    if (currentState.cursor > 0) {
      params.set("cursor", String(currentState.cursor));
    }
    if (currentState.limit !== DEFAULT_PAGE_LIMIT) {
      params.set("limit", String(currentState.limit));
    }
    for (const feedId of currentState.feedIds) {
      params.append("feed", feedId);
    }

    setOverlayArticles([]);
    setLoading(true);
    setError(null);

    void fetch(`/api/articles?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Failed to load articles");
        }

        return (await response.json()) as FeedsWorkspaceInitialBrowse;
      })
      .then((payload) => {
        setBrowse(payload);
      })
      .catch((nextError) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(nextError instanceof Error ? nextError.message : "Failed to load articles");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [currentState, initialParamsString, searchParamsString]);

  const candidateFeeds = useMemo(
    () =>
      feeds.filter((feed) =>
        matchesFeedSlice(feed, {
          feedIds: currentState.feedIds,
          sourceType: currentState.sourceType,
          topics: currentState.topics,
          verified: currentState.verified,
        }),
      ),
    [
      currentState.feedIds,
      currentState.sourceType,
      currentState.topics,
      currentState.verified,
      feeds,
    ],
  );

  const articleStateMap = useMemo(() => {
    const nextStateMap: Record<string, ReaderArticleState> = {};
    const corpusArticles = browse.items.map(normalizeArticle);
    for (const article of [...overlayArticles, ...cachedArticles, ...corpusArticles]) {
      nextStateMap[article.id] = articleStates[article.id] ?? readArticleState(article.id);
    }
    return nextStateMap;
  }, [articleStates, browse.items, cachedArticles, overlayArticles]);

  useEffect(() => {
    setArticleStates((current) => {
      const nextState = { ...current };
      let changed = false;

      const corpusArticles = browse.items.map(normalizeArticle);
      for (const article of [...overlayArticles, ...cachedArticles, ...corpusArticles]) {
        if (!nextState[article.id]) {
          nextState[article.id] = readArticleState(article.id);
          changed = true;
        }
      }

      return changed ? nextState : current;
    });
  }, [browse.items, cachedArticles, overlayArticles]);

  const mergedArticles = useMemo(() => {
    const seen = new Set<string>();
    const ordered = [...overlayArticles, ...cachedArticles, ...browse.items.map(normalizeArticle)];
    return ordered.filter((article) => {
      const dedupeKey = article.id || `${article.feed_id}:${article.link}`;
      if (seen.has(dedupeKey)) {
        return false;
      }
      seen.add(dedupeKey);
      return true;
    });
  }, [browse.items, cachedArticles, overlayArticles]);

  const visibleArticles = useMemo(() => {
    return mergedArticles.filter((article) =>
      matchesReaderView(
        currentState.readerView,
        articleStateMap[article.id] ?? DEFAULT_ARTICLE_STATE,
      ),
    );
  }, [articleStateMap, currentState.readerView, mergedArticles]);

  useEffect(() => {
    if (previewArticleId && !visibleArticles.some((article) => article.id === previewArticleId)) {
      setPreviewArticleId(null);
    }
  }, [previewArticleId, visibleArticles]);

  const selectedArticle =
    visibleArticles.find((article) => article.id === previewArticleId) ?? null;

  const selectedArticleState = selectedArticle
    ? articleStateMap[selectedArticle.id] ?? DEFAULT_ARTICLE_STATE
    : DEFAULT_ARTICLE_STATE;

  const updateUrl = useCallback(
    (overrides: Record<string, string | string[] | null | undefined>) => {
      const nextHref = buildReaderHref(currentState, overrides);
      router.replace(nextHref, { scroll: false });
    },
    [currentState, router],
  );

  const updateState = (articleId: string, partial: Partial<ReaderArticleState>) => {
    setArticleStates((current) => {
      const nextArticleState = {
        ...(current[articleId] ?? readArticleState(articleId)),
        ...partial,
      };
      writeArticleState(articleId, nextArticleState);
      // Wire IDB persistence: fire-and-forget sync (caller keeps LS via writeArticleState as fallback)
      void syncArticleState(articleId, partial);
      return {
        ...current,
        [articleId]: nextArticleState,
      };
    });
  };

  const refreshLatest = useCallback(
    async (forceRefresh = true) => {
      const feedIds =
        currentState.feedIds.length > 0
          ? currentState.feedIds
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
            q: currentState.query || null,
            sort: currentState.sort,
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
    [candidateFeeds, currentState.feedIds, currentState.query, currentState.sort, mergedArticles],
  );

  const sourceTypes = useMemo(() => getSourceTypesFromFeeds(feeds), [feeds]);
  const topicOptions = useMemo(() => getTopics(feeds), [feeds]);
  const topicCounts = useMemo(
    () =>
      topicOptions
        .map((topic) => ({
          topic,
          count: feeds.filter((feed) =>
            new Set([...(feed.topics ?? []), ...(feed.tags ?? [])]).has(topic),
          ).length,
        }))
        .sort((left, right) => right.count - left.count || left.topic.localeCompare(right.topic))
        .slice(0, 12),
    [feeds, topicOptions],
  );
  const availableTopicOptions = useMemo(
    () => topicOptions.filter((topic) => !topicsDraft.includes(topic)),
    [topicOptions, topicsDraft],
  );
  const feedLookup = useMemo(
    () =>
      new Map(
        feeds
          .filter((feed): feed is FeedSource & { id: string } => typeof feed.id === "string")
          .map((feed) => [feed.id, feed]),
      ),
    [feeds],
  );

  useEffect(() => {
    if (!localIndexReady) {
      setCachedArticles((current) => (current.length === 0 ? current : []));
      return;
    }

    const query = currentState.query.trim();
    if (!query) {
      setCachedArticles((current) => (current.length === 0 ? current : []));
      return;
    }

    const results = searchLocal(query, {
      limit: 24,
      feedIds: currentState.feedIds.length > 0 ? currentState.feedIds : undefined,
      topics: currentState.topics.length > 0 ? currentState.topics : undefined,
      unreadOnly: currentState.readerView === "unread",
      starredOnly: currentState.readerView === "starred",
      bookmarkedOnly: currentState.readerView === "saved",
      isBookmarked: (articleId) =>
        (articleStates[articleId] ?? readArticleState(articleId)).bookmarked,
    });

    const knownIds = new Set([
      ...browse.items.map((item) => item.id),
      ...overlayArticles.map((item) => item.id),
    ]);

    setCachedArticles(
      results
        .filter((result) => !knownIds.has(result.article.id))
        .map((result) =>
          normalizeCachedArticle(result.article, feedLookup.get(result.article.feedId)?.title),
        ),
    );
  }, [
    articleStates,
    browse.items,
    currentState.feedIds,
    currentState.query,
    currentState.readerView,
    currentState.topics,
    feedLookup,
    localIndexReady,
    overlayArticles,
    searchLocal,
  ]);

  const selectedArticleSource = selectedArticle ? feedLookup.get(selectedArticle.feed_id) : null;
  const corpusEmpty = browse.corpus.is_empty;
  const canClearArticleFilters =
    Boolean(currentState.query) || currentState.readerView !== "latest" || currentState.cursor > 0;
  const canResetWorkspace =
    canClearArticleFilters ||
    Boolean(currentState.sourceType) ||
    currentState.topics.length > 0 ||
    currentState.feedIds.length > 0 ||
    currentState.verified !== null ||
    currentState.sort !== "latest";
  const clearArticleFiltersHref = buildReaderHref(currentState, {
    q: null,
    reader_view: null,
    cursor: null,
  });
  const resetWorkspaceHref = CANONICAL_READER_PATH;
  const catalogRecoveryHref = CANONICAL_CATALOG_PATH;
  const filterSummary =
    currentState.feedIds.length > 0
      ? `${currentState.feedIds.length} pinned feed${currentState.feedIds.length === 1 ? "" : "s"}`
      : `${candidateFeeds.length} ${stats.hasActivityMetadata ? "active" : "tracked"} source${
          candidateFeeds.length === 1 ? "" : "s"
        } matching these filters`;
  const visibleArticleCountLabel = corpusEmpty
    ? `${overlayArticles.length} live post${overlayArticles.length === 1 ? "" : "s"} loaded`
    : `${browse.total_matched} article match${browse.total_matched === 1 ? "" : "es"}`;
  const sourceStatValue = stats.hasActivityMetadata ? stats.active : stats.total;
  const sourceStatNote = stats.hasVerificationMetadata
    ? `${stats.verified} verified sources currently tracked`
    : "Verification metadata is not present in this catalog";
  const activeFilterChips = useMemo(
    () => buildCurrentFilterChips(currentState, feedLookup),
    [currentState, feedLookup],
  );
  const draftState: ReaderDraftState = useMemo(
    () => ({
      query: queryDraft,
      sourceType: sourceTypeDraft,
      topics: topicsDraft,
      verified: verifiedDraft,
      readerView: readerViewDraft,
      sort: sortDraft,
    }),
    [queryDraft, readerViewDraft, sortDraft, sourceTypeDraft, topicsDraft, verifiedDraft],
  );
  const hasPendingDraftChanges = !matchesDraftState(draftState, currentState);
  const freshnessTimestamp =
    browse.corpus.generated_at ?? browse.corpus.latest_published_at ?? null;
  const readerStats = [
    {
      label: "Freshness",
      value: corpusEmpty
        ? "Live mode"
        : freshnessTimestamp
          ? formatSnapshotTimestamp(freshnessTimestamp)
          : "Waiting",
      note: corpusEmpty
        ? "Recent posts loaded live"
        : browse.corpus.generated_at
          ? "Prepared posts ready"
          : "Live sample ready",
      icon: Clock3,
    },
    {
      label: "Visible",
      value: String(visibleArticles.length),
      note: corpusEmpty
        ? `${overlayArticles.length} live post${overlayArticles.length === 1 ? "" : "s"}`
        : `${browse.total_matched} match${browse.total_matched === 1 ? "" : "es"}`,
      icon: Newspaper,
    },
    {
      label: "Sources",
      value: String(corpusEmpty ? candidateFeeds.length : sourceStatValue),
      note: corpusEmpty
        ? `${Math.min(candidateFeeds.length, LIVE_REFRESH_SAMPLE_FEED_LIMIT)} source live sample`
        : sourceStatNote,
      icon: Filter,
    },
    {
      label: "New",
      value: String(overlayArticles.length),
      note:
        overlayArticles.length > 0
          ? corpusEmpty
            ? "Live posts in stream"
            : "Layered above prepared posts"
          : "No live additions",
      icon: RefreshCcw,
    },
  ];
  const livePendingSources = liveProgress
    ? Math.max(
        liveProgress.totalSources - liveProgress.successfulSources - liveProgress.failedSources,
        0,
      )
    : 0;
  const liveStatusText = liveProgress
    ? `${
        liveProgress.successfulSources + liveProgress.failedSources
      } sources checked · ${livePendingSources} loading · ${visibleArticles.length} posts shown`
    : null;

  const applyDrafts = useCallback(() => {
    setPreviewArticleId(null);
    updateUrl({
      q: normalizeQueryDraft(queryDraft) || null,
      source_type: sourceTypeDraft || null,
      topics: topicsDraft.length > 0 ? normalizeTopicsValue(topicsDraft) : null,
      verified: verifiedDraft || null,
      reader_view: readerViewDraft === "latest" ? null : readerViewDraft,
      sort: sortDraft === "latest" ? null : sortDraft,
      cursor: null,
    });
    setMobileControlsOpen(false);
  }, [
    queryDraft,
    readerViewDraft,
    sortDraft,
    sourceTypeDraft,
    topicsDraft,
    updateUrl,
    verifiedDraft,
  ]);

  const resetDrafts = useCallback(() => {
    setPreviewArticleId(null);
    setQueryDraft("");
    setSourceTypeDraft("");
    setTopicsDraft([]);
    setVerifiedDraft("");
    setReaderViewDraft("latest");
    setSortDraft("latest");
    updateUrl({
      q: null,
      source_type: null,
      topics: null,
      verified: null,
      reader_view: null,
      sort: null,
      cursor: null,
    });
    setMobileControlsOpen(false);
  }, [updateUrl]);

  const handleSelectArticle = useCallback((articleId: string) => {
    setPreviewArticleId((current) => (current === articleId ? null : articleId));
  }, []);

  const selectAdjacentArticle = useCallback(
    (delta: number) => {
      if (visibleArticles.length === 0) {
        return;
      }

      const currentIndex = previewArticleId
        ? visibleArticles.findIndex((article) => article.id === previewArticleId)
        : -1;
      const nextIndex =
        currentIndex < 0
          ? delta > 0
            ? 0
            : visibleArticles.length - 1
          : Math.min(visibleArticles.length - 1, Math.max(0, currentIndex + delta));

      setPreviewArticleId(visibleArticles[nextIndex]?.id ?? null);
    },
    [previewArticleId, visibleArticles],
  );

  const shortcutHandlers = useMemo(
    () => ({
      next_article: () => selectAdjacentArticle(1),
      previous_article: () => selectAdjacentArticle(-1),
      mark_as_read: () => {
        if (!selectedArticle) {
          return;
        }
        updateState(selectedArticle.id, { read: !selectedArticleState.read });
      },
      star: () => {
        if (!selectedArticle) {
          return;
        }
        updateState(selectedArticle.id, { starred: !selectedArticleState.starred });
      },
      archive: () => {
        if (!selectedArticle) {
          return;
        }
        updateState(selectedArticle.id, { archived: !selectedArticleState.archived });
      },
      open_original: () => {
        if (!selectedArticle) {
          return;
        }
        window.open(selectedArticle.link, "_blank", "noopener,noreferrer");
      },
      refresh: () => void refreshLatest(true),
      focus_search: () => queryInputRef.current?.focus(),
      close_modal: () => setPreviewArticleId(null),
      go_home: () => router.push("/"),
      go_unread: () => updateUrl({ reader_view: "unread", cursor: null }),
      go_starred: () => updateUrl({ reader_view: "starred", cursor: null }),
      go_all: () => updateUrl({ reader_view: null, cursor: null }),
    }),
    [
      refreshLatest,
      router,
      selectAdjacentArticle,
      selectedArticle,
      selectedArticleState.archived,
      selectedArticleState.read,
      selectedArticleState.starred,
      updateUrl,
    ],
  );

  useReaderShortcuts(shortcutHandlers);

  useEffect(() => {
    if (!previewArticleId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewArticleId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewArticleId]);

  if (corpusEmpty && overlayArticles.length === 0 && !refreshing) {
    return (
      <ReaderCorpusEmpty
        refreshError={refreshError}
        refreshing={refreshing}
        candidateFeedCount={candidateFeeds.length}
        onLoadLiveSample={() => void refreshLatest(true)}
      />
    );
  }

  return (
    <div className="reader-shell space-y-5">
      <ReaderShellHeader
        corpusEmpty={corpusEmpty}
        overlayCount={overlayArticles.length}
        refreshing={refreshing}
        liveStatusText={liveStatusText}
        readerStats={readerStats}
        onRefreshLatest={() => void refreshLatest(true)}
      />

      <div
        data-testid="reader-workspace-grid"
        className={cn(
          "grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]",
          selectedArticle && "xl:grid-cols-[18rem_minmax(0,1fr)_22rem]",
          selectedArticle && "2xl:grid-cols-[20rem_minmax(0,1fr)_24rem]",
        )}
      >
        <div className="hidden xl:block xl:sticky xl:top-24 xl:self-start">
          <div className="surface-card border-(--line) bg-(--surface) p-4">
            <div className="space-y-2">
              <p className="metric-label">Focus</p>
              <p className="small-note">Narrow the stream without leaving the reader.</p>
            </div>
            <ReaderFiltersForm
              variant="desktop"
              draftState={draftState}
              setQuery={setQueryDraft}
              setSourceType={setSourceTypeDraft}
              setTopics={setTopicsDraft}
              setVerified={setVerifiedDraft}
              setReaderView={setReaderViewDraft}
              setSort={setSortDraft}
              applyDrafts={applyDrafts}
              resetDrafts={resetDrafts}
              topicCounts={topicCounts}
              hasVerificationMetadata={stats.hasVerificationMetadata}
              layout={preferences.layout}
              onLayoutChange={(next) => update({ layout: next })}
              sourceTypes={sourceTypes}
              availableTopicOptions={availableTopicOptions}
              queryInputRef={queryInputRef}
              hasPendingDraftChanges={hasPendingDraftChanges}
            />

            <div className="surface-card-soft mt-5 border-(--line) p-4">
              <p className="metric-label">Current view</p>
              <div className="mt-3 space-y-2 text-sm text-(--ink-muted)">
                <p>{filterSummary}</p>
                <p>
                  {visibleArticleCountLabel} · {visibleArticles.length} visible on this page
                </p>
                <p>
                  Prepared: {browse.corpus.article_count} articles from {browse.corpus.feed_count}{" "}
                  sources
                </p>
                <p>
                  Catalog: {stats.total} tracked sources · {stats.topicCount} topics
                </p>
              </div>
            </div>
          </div>
        </div>

        <section className="space-y-5">
          <details
            className="surface-card relative isolate z-20 border-(--line) bg-(--surface) p-4 xl:hidden"
            open={mobileControlsOpen}
            onToggle={(event) =>
              setMobileControlsOpen((event.currentTarget as HTMLDetailsElement).open)
            }
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-(--ink-muted)" />
                <span className="text-sm font-semibold text-(--ink)">Filters and view</span>
              </div>
              <span className="small-note">
                {activeFilterChips.length > 0 ? `${activeFilterChips.length} active` : "All posts"}
              </span>
            </summary>
            <ReaderFiltersForm
              variant="mobile"
              draftState={draftState}
              setQuery={setQueryDraft}
              setSourceType={setSourceTypeDraft}
              setTopics={setTopicsDraft}
              setVerified={setVerifiedDraft}
              setReaderView={setReaderViewDraft}
              setSort={setSortDraft}
              applyDrafts={applyDrafts}
              resetDrafts={resetDrafts}
              topicCounts={topicCounts}
              hasVerificationMetadata={stats.hasVerificationMetadata}
              layout={preferences.layout}
              onLayoutChange={(next) => update({ layout: next })}
              sourceTypes={sourceTypes}
              availableTopicOptions={availableTopicOptions}
              hasPendingDraftChanges={hasPendingDraftChanges}
            />
          </details>

          <ReaderArticleStream
            query={currentState.query}
            filterSummary={filterSummary}
            refreshError={refreshError}
            error={error}
            activeFilterChips={activeFilterChips}
            loading={loading}
            refreshing={refreshing}
            visibleArticles={visibleArticles}
            articleStateMap={articleStateMap}
            selectedArticleId={selectedArticle?.id ?? null}
            feedLookup={feedLookup}
            layout={preferences.layout}
            showSummaries={preferences.showSummaries}
            browseCursor={browse.cursor}
            browseLimit={browse.limit}
            browseNextCursor={browse.next_cursor}
            canClearArticleFilters={canClearArticleFilters}
            canResetWorkspace={canResetWorkspace}
            clearArticleFiltersHref={clearArticleFiltersHref}
            resetWorkspaceHref={resetWorkspaceHref}
            catalogRecoveryHref={catalogRecoveryHref}
            onSelectArticle={handleSelectArticle}
            onUpdateState={updateState}
            onClosePreview={() => setPreviewArticleId(null)}
            onFilterChip={updateUrl}
            onResetDrafts={resetDrafts}
            onPaginate={(cursor) => updateUrl({ cursor })}
          />
        </section>

        {selectedArticle ? (
          <div className="hidden xl:block xl:sticky xl:top-24 xl:self-start">
            <ReaderPreviewPane
              article={selectedArticle}
              source={selectedArticleSource}
              state={selectedArticleState}
              variant="panel"
              onClose={() => setPreviewArticleId(null)}
              onToggleState={(partial) => {
                if (!selectedArticle) {
                  return;
                }
                updateState(selectedArticle.id, partial);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FeedsWorkspaceClient({
  mode,
  feeds,
  stats,
  initialState,
  initialBrowse,
}: FeedsWorkspaceClientProps) {
  const sourceTypes = useMemo(() => getSourceTypesFromFeeds(feeds), [feeds]);

  if (mode === "catalog") {
    return (
      <FeedCatalog
        feeds={feeds}
        sourceTypes={sourceTypes}
        initialQuery={initialState.query}
        initialSourceType={initialState.sourceType}
        initialTopics={initialState.topics}
        initialVerified={initialState.verified}
      />
    );
  }

  return (
    <ReaderShell
      feeds={feeds}
      stats={stats}
      initialState={initialState}
      initialBrowse={
        initialBrowse ?? {
          items: [],
          next_cursor: null,
          total_matched: 0,
          cursor: 0,
          limit: DEFAULT_PAGE_LIMIT,
          applied_query: null,
          applied_sort: "latest",
          corpus: {
            generated_at: null,
            schema_version: "articles-3.0.0",
            source_db: "data/ai-web-feeds.db",
            article_count: 0,
            feed_count: 0,
            latest_published_at: null,
            freshness_watermark: null,
            is_empty: true,
          },
        }
      }
    />
  );
}
