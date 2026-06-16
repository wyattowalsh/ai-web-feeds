import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import type {
  FeedsWorkspaceInitialBrowse,
  FeedsWorkspaceInitialState,
} from "@/lib/reader-route-types";

import { useReaderOverlayBridge } from "./use-reader-overlay-bridge";

const browseHook = vi.hoisted(() => ({
  browse: {
    items: [{ id: "article-1", feed_id: "feed-1", title: "One" }],
    next_cursor: null,
    total_matched: 1,
    cursor: 0,
    limit: 24,
    applied_query: null,
    applied_sort: "latest",
    corpus: {
      generated_at: null,
      schema_version: "articles-3.0.0",
      source_db: "data/ai-web-feeds.db",
      article_count: 1,
      feed_count: 1,
      latest_published_at: null,
      freshness_watermark: null,
      is_empty: false,
    },
  },
  loading: false,
  error: null as string | null,
  onBrowseStart: undefined as (() => void) | undefined,
}));

const liveHook = vi.hoisted(() => ({
  refreshing: false,
  refreshError: null as string | null,
  liveProgress: null,
  overlayArticles: [] as Array<{ id: string }>,
  setOverlayArticles: vi.fn(),
  refreshLatest: vi.fn(),
  mergedArticlesArg: [] as Array<{ id: string }>,
}));

const streamHook = vi.hoisted(() => ({
  articleStateMap: { "article-1": { read: false, starred: false, saved: false, archived: false } },
  mergedArticles: [{ id: "article-1" }],
  visibleArticles: [{ id: "article-1" }],
  updateState: vi.fn(),
}));

vi.mock("./use-reader-corpus-browse", () => ({
  useReaderCorpusBrowse: (params: { onBrowseStart?: () => void }) => {
    browseHook.onBrowseStart = params.onBrowseStart;
    return {
      browse: browseHook.browse,
      loading: browseHook.loading,
      error: browseHook.error,
    };
  },
}));

vi.mock("./use-reader-live-refresh", () => ({
  useReaderLiveRefresh: (params: { mergedArticles: Array<{ id: string }> }) => {
    liveHook.mergedArticlesArg = params.mergedArticles;
    return {
      refreshing: liveHook.refreshing,
      refreshError: liveHook.refreshError,
      liveProgress: liveHook.liveProgress,
      overlayArticles: liveHook.overlayArticles,
      setOverlayArticles: liveHook.setOverlayArticles,
      refreshLatest: liveHook.refreshLatest,
    };
  },
}));

vi.mock("./use-reader-article-stream", () => ({
  useReaderArticleStream: () => ({
    articleStateMap: streamHook.articleStateMap,
    mergedArticles: streamHook.mergedArticles,
    visibleArticles: streamHook.visibleArticles,
    updateState: streamHook.updateState,
  }),
}));

const currentState: FeedsWorkspaceInitialState = {
  query: "",
  feedIds: [],
  sourceType: null,
  topics: [],
  verified: null,
  sort: "latest",
  readerView: "latest",
  cursor: 0,
};

const initialBrowse = browseHook.browse as FeedsWorkspaceInitialBrowse;

describe("useReaderOverlayBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveHook.overlayArticles = [];
    streamHook.mergedArticles = [{ id: "article-1" }];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderBridge() {
    return renderHook(() =>
      useReaderOverlayBridge({
        currentState,
        initialParamsString: "",
        searchParamsString: "",
        initialBrowse,
        candidateFeeds: [],
        feedLookup: new Map(),
        localIndexReady: false,
        searchLocal: () => [],
      }),
    );
  }

  it("surfaces stream and browse outputs", () => {
    const { result } = renderBridge();

    expect(result.current.visibleArticles).toHaveLength(1);
    expect(result.current.corpusEmpty).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("clears overlay when browse starts", () => {
    renderBridge();
    expect(browseHook.onBrowseStart).toBeTypeOf("function");
    browseHook.onBrowseStart?.();
    expect(liveHook.setOverlayArticles).toHaveBeenCalledWith([]);
  });

  it("forwards merged articles into live refresh after the ref bridge updates", () => {
    const { rerender } = renderBridge();
    expect(liveHook.mergedArticlesArg).toEqual([]);
    rerender();
    expect(liveHook.mergedArticlesArg).toEqual([{ id: "article-1" }]);
  });
});
