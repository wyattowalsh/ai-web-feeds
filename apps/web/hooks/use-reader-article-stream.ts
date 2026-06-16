"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { FeedSource } from "@/lib/feeds-filters";
import type {
  FeedsWorkspaceInitialBrowse,
  FeedsWorkspaceInitialState,
} from "@/lib/reader-route-types";
import {
  DEFAULT_ARTICLE_STATE,
  matchesReaderView,
  normalizeArticle,
  normalizeCachedArticle,
  readArticleState,
  writeArticleState,
  type ReaderArticleState,
  type WorkspaceArticle,
} from "@/lib/reader";
import {
  hydrateArticleStates,
  loadArticleStatesFromIDB,
  syncArticleState,
} from "@/lib/reader/hydrate-article-state";
import type { LocalSearchOptions, LocalSearchResult } from "@/lib/reader/local-search";

export interface UseReaderArticleStreamParams {
  browseItems: FeedsWorkspaceInitialBrowse["items"];
  overlayArticles: WorkspaceArticle[];
  currentState: FeedsWorkspaceInitialState;
  feedLookup: Map<string, FeedSource>;
  localIndexReady: boolean;
  searchLocal: (query: string, options: LocalSearchOptions) => LocalSearchResult[];
}

export interface UseReaderArticleStreamResult {
  articleStates: Record<string, ReaderArticleState>;
  setArticleStates: Dispatch<SetStateAction<Record<string, ReaderArticleState>>>;
  articleStateMap: Record<string, ReaderArticleState>;
  mergedArticles: WorkspaceArticle[];
  visibleArticles: WorkspaceArticle[];
  cachedArticles: WorkspaceArticle[];
  updateState: (articleId: string, partial: Partial<ReaderArticleState>) => void;
}

/**
 * Hook extracted (wave 6 reader polish): article merge/state logic pulled out of
 * feeds-workspace-client.tsx (ReaderShell).
 *
 * Responsibilities (verbatim behavior preserved):
 * - articleStates state + one-time hydrate effect (hydrateArticleStates + IDB load/merge)
 * - mergedArticles useMemo (overlay + cached + browse items with dedupe by id or feed:link)
 * - articleStateMap useMemo (overlay+cached+corpus, falling back to readArticleState)
 * - articleStates seeding useEffect (pre-populate read states for seen articles)
 * - visibleArticles useMemo (filter via matchesReaderView on readerView + state)
 * - cachedArticles state + local search effect (when query+indexReady, using searchLocal
 *   with view-specific flags + isBookmarked predicate from articleStates; deduped vs browse/overlay)
 * - updateState (updates in-mem state, writeArticleState to LS, fire-and-forget syncArticleState to IDB)
 *
 * Follows extraction patterns from use-reader-corpus-browse.ts and use-reader-live-refresh.ts.
 */
export function useReaderArticleStream(
  params: UseReaderArticleStreamParams,
): UseReaderArticleStreamResult {
  const { browseItems, overlayArticles, currentState, feedLookup, localIndexReady, searchLocal } =
    params;

  const [cachedArticles, setCachedArticles] = useState<WorkspaceArticle[]>([]);
  const [articleStates, setArticleStates] = useState<Record<string, ReaderArticleState>>({});

  // Hydrate (migrate LS->IDB) on mount + merge any IDB states into our articleStates
  // (clearLocalStorage:false to preserve LS as fallback; IDB is additive overlay)
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

  const mergedArticles = useMemo(() => {
    const seen = new Set<string>();
    const ordered = [...overlayArticles, ...cachedArticles, ...browseItems.map(normalizeArticle)];
    return ordered.filter((article) => {
      const dedupeKey = article.id || `${article.feed_id}:${article.link}`;
      if (seen.has(dedupeKey)) {
        return false;
      }
      seen.add(dedupeKey);
      return true;
    });
  }, [browseItems, cachedArticles, overlayArticles]);

  const articleStateMap = useMemo(() => {
    const nextStateMap: Record<string, ReaderArticleState> = {};
    const corpusArticles = browseItems.map(normalizeArticle);
    for (const article of [...overlayArticles, ...cachedArticles, ...corpusArticles]) {
      nextStateMap[article.id] = articleStates[article.id] ?? readArticleState(article.id);
    }
    return nextStateMap;
  }, [articleStates, browseItems, cachedArticles, overlayArticles]);

  // Seed articleStates for newly encountered articles so articleStateMap consumers
  // see them without falling back to readArticleState on every render.
  useEffect(() => {
    setArticleStates((current) => {
      const nextState = { ...current };
      let changed = false;

      const corpusArticles = browseItems.map(normalizeArticle);
      for (const article of [...overlayArticles, ...cachedArticles, ...corpusArticles]) {
        if (!nextState[article.id]) {
          nextState[article.id] = readArticleState(article.id);
          changed = true;
        }
      }

      return changed ? nextState : current;
    });
  }, [browseItems, cachedArticles, overlayArticles]);

  const visibleArticles = useMemo(() => {
    return mergedArticles.filter((article) =>
      matchesReaderView(
        currentState.readerView,
        articleStateMap[article.id] ?? DEFAULT_ARTICLE_STATE,
      ),
    );
  }, [articleStateMap, currentState.readerView, mergedArticles]);

  // Local/cached search overlay effect: populates cachedArticles from IDB-backed index
  // when a query is active. Respects feed/topic/view filters and bookmarked predicate.
  // Dedupes results already present in browse or live overlay.
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
      ...browseItems.map((item) => item.id),
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
    browseItems,
    currentState.feedIds,
    currentState.query,
    currentState.readerView,
    currentState.topics,
    feedLookup,
    localIndexReady,
    overlayArticles,
    searchLocal,
  ]);

  const updateState = useCallback((articleId: string, partial: Partial<ReaderArticleState>) => {
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
  }, []);

  return {
    articleStates,
    setArticleStates,
    articleStateMap,
    mergedArticles,
    visibleArticles,
    cachedArticles,
    updateState,
  };
}
