"use client";

import { useRef } from "react";

import type { FeedSource } from "@/lib/feeds-filters";
import type {
  FeedsWorkspaceInitialBrowse,
  FeedsWorkspaceInitialState,
} from "@/lib/reader-route-types";
import type { WorkspaceArticle } from "@/lib/reader";
import type { LocalSearchOptions, LocalSearchResult } from "@/lib/reader/local-search";

import { useReaderArticleStream } from "./use-reader-article-stream";
import { useReaderCorpusBrowse } from "./use-reader-corpus-browse";
import { useReaderLiveRefresh } from "./use-reader-live-refresh";

export interface UseReaderOverlayBridgeParams {
  currentState: FeedsWorkspaceInitialState;
  initialParamsString: string;
  searchParamsString: string;
  initialBrowse: FeedsWorkspaceInitialBrowse;
  candidateFeeds: FeedSource[];
  feedLookup: Map<string, FeedSource>;
  localIndexReady: boolean;
  searchLocal: (query: string, options: LocalSearchOptions) => LocalSearchResult[];
}

export function useReaderOverlayBridge(params: UseReaderOverlayBridgeParams) {
  const {
    currentState,
    initialParamsString,
    searchParamsString,
    initialBrowse,
    candidateFeeds,
    feedLookup,
    localIndexReady,
    searchLocal,
  } = params;

  const overlayClearRef = useRef<(() => void) | null>(null);
  const mergedArticlesRef = useRef<WorkspaceArticle[]>([]);

  const { browse, loading, error } = useReaderCorpusBrowse({
    currentState,
    initialParamsString,
    searchParamsString,
    initialBrowse,
    onBrowseStart: () => overlayClearRef.current?.(),
  });

  const {
    refreshing,
    refreshError,
    liveProgress,
    overlayArticles,
    setOverlayArticles,
    refreshLatest,
  } = useReaderLiveRefresh({
    candidateFeeds,
    feedIds: currentState.feedIds,
    query: currentState.query,
    sort: currentState.sort,
    mergedArticles: mergedArticlesRef.current,
  });

  overlayClearRef.current = () => setOverlayArticles([]);

  const { articleStateMap, mergedArticles, visibleArticles, updateState } = useReaderArticleStream({
    browseItems: browse.items,
    overlayArticles,
    currentState,
    feedLookup,
    localIndexReady,
    searchLocal,
  });

  mergedArticlesRef.current = mergedArticles;

  return {
    browse,
    loading,
    error,
    refreshing,
    refreshError,
    liveProgress,
    overlayArticles,
    refreshLatest,
    articleStateMap,
    mergedArticles,
    visibleArticles,
    updateState,
    corpusEmpty: browse.corpus.is_empty,
  };
}
