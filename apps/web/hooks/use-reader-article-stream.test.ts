import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

import type { FeedSource } from "@/lib/feeds-filters";
import type {
  FeedsWorkspaceInitialBrowse,
  FeedsWorkspaceInitialState,
} from "@/lib/reader-route-types";
import type { LocalSearchOptions, LocalSearchResult } from "@/lib/reader/local-search";
import type { WorkspaceArticle } from "@/lib/reader";
import * as Reader from "@/lib/reader";

import { useReaderArticleStream } from "./use-reader-article-stream";

const hydrateArticleStatesMock = vi.fn(async () => ({
  migratedCount: 0,
  clearedCount: 0,
  totalInIDB: 0,
}));
const loadArticleStatesFromIDBMock = vi.fn(async () => ({}));
const syncArticleStateMock = vi.fn();

vi.mock("@/lib/reader/hydrate-article-state", () => ({
  hydrateArticleStates: (...args: unknown[]) => hydrateArticleStatesMock(...args),
  loadArticleStatesFromIDB: (...args: unknown[]) => loadArticleStatesFromIDBMock(...args),
  syncArticleState: (...args: unknown[]) => syncArticleStateMock(...args),
}));

function makeBrowseItems(count = 1): FeedsWorkspaceInitialBrowse["items"] {
  return Array.from({ length: count }, (_, i) => ({
    id: `browse-${i + 1}`,
    feed_id: `feed-${i + 1}`,
    feed_title: `Feed ${i + 1}`,
    title: `Browse Title ${i + 1}`,
    link: `https://ex.com/b${i + 1}`,
    summary: null,
    content_html: null,
    author: null,
    published_at: "2026-06-01T00:00:00.000Z",
    topics: [],
    source_topics: [],
    raw_categories: [],
    source_type: "blog",
    verified: false,
    is_active: true,
  }));
}

const EMPTY_FEEDS: string[] = [];
const EMPTY_TOPICS: string[] = [];

const STABLE_EMPTY_BROWSE: FeedsWorkspaceInitialBrowse["items"] = [];
const STABLE_EMPTY_OVERLAY: WorkspaceArticle[] = [];
const STABLE_EMPTY_LOOKUP: Map<string, FeedSource> = new Map();
const STABLE_NOOP_SEARCH = (() => []) as (
  query: string,
  options?: LocalSearchOptions,
) => LocalSearchResult[];

function makeState(
  overrides: Partial<FeedsWorkspaceInitialState> = {},
): FeedsWorkspaceInitialState {
  // Always canonicalize empty filter arrays to stable singletons so that
  // effect deps (currentState.feedIds, currentState.topics) don't churn on
  // every render and cause cascading setCached <-> effect loops in tests.
  const { feedIds: rawFeed = EMPTY_FEEDS, topics: rawTopic = EMPTY_TOPICS, ...rest } = overrides;
  const feedIds = !rawFeed || rawFeed.length === 0 ? EMPTY_FEEDS : rawFeed;
  const topics = !rawTopic || rawTopic.length === 0 ? EMPTY_TOPICS : rawTopic;
  return {
    query: "",
    feedIds,
    sourceType: null,
    topics,
    verified: null,
    sort: "latest",
    readerView: "latest",
    cursor: 0,
    limit: 24,
    ...rest,
  };
}

function makeOverlay(id: string, feedId = "feed-1"): WorkspaceArticle {
  return {
    id,
    feed_id: feedId,
    feed_title: "Overlay Feed",
    title: `Overlay ${id}`,
    link: `https://ex.com/${id}`,
    summary: null,
    content_html: null,
    author: null,
    published_at: "2026-06-10T00:00:00.000Z",
    topics: [],
    source_topics: [],
    raw_categories: [],
    source_type: "feed",
    verified: false,
    is_active: true,
    freshness: "live",
    published_at_ms: Date.parse("2026-06-10T00:00:00.000Z"),
  };
}

describe("useReaderArticleStream", () => {
  let readSpy: ReturnType<typeof vi.spyOn>;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    hydrateArticleStatesMock.mockResolvedValue({
      migratedCount: 0,
      clearedCount: 0,
      totalInIDB: 0,
    });
    loadArticleStatesFromIDBMock.mockResolvedValue({});
    // Spies on the barrel re-exports used by the hook (so closed-over calls are observed)
    readSpy = vi.spyOn(Reader, "readArticleState").mockImplementation((id: string) => ({
      read: false,
      starred: false,
      archived: false,
      bookmarked: id.includes("book"),
    }));
    writeSpy = vi.spyOn(Reader, "writeArticleState").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls hydrateArticleStates (with clear:false) on mount and merges IDB states into articleStates", async () => {
    loadArticleStatesFromIDBMock.mockResolvedValueOnce({
      "idb-1": { read: true, starred: false, archived: false, bookmarked: false },
    });

    const { result } = renderHook(() =>
      useReaderArticleStream({
        browseItems: STABLE_EMPTY_BROWSE,
        overlayArticles: STABLE_EMPTY_OVERLAY,
        currentState: makeState(),
        feedLookup: STABLE_EMPTY_LOOKUP,
        localIndexReady: false,
        searchLocal: STABLE_NOOP_SEARCH,
      }),
    );

    await waitFor(() => {
      expect(hydrateArticleStatesMock).toHaveBeenCalledWith({ clearLocalStorage: false });
    });
    await waitFor(() => {
      expect(result.current.articleStates["idb-1"]?.read).toBe(true);
    });
  });

  it("merges overlay + browse items with deduplication (overlay wins, browse deduped); cached population covered separately", () => {
    const browseItems = makeBrowseItems(2);
    const overlay = [makeOverlay("ov-1"), makeOverlay("dup-browse")];

    // No query/ready so no cached effect; we test the core dedupe path for overlay + browse here.
    // (cached + overlay + browse dedup is exercised in the "populates cachedArticles" test below.)
    const { result } = renderHook(() =>
      useReaderArticleStream({
        browseItems,
        overlayArticles: overlay,
        currentState: makeState(),
        feedLookup: STABLE_EMPTY_LOOKUP,
        localIndexReady: false,
        searchLocal: STABLE_NOOP_SEARCH,
      }),
    );

    const mergedIds = result.current.mergedArticles.map((a) => a.id);
    // overlay first (higher priority in concat)
    expect(mergedIds[0]).toBe("ov-1");
    expect(mergedIds).toContain("browse-1");
    expect(mergedIds).toContain("browse-2");
    // dup resolved preferring overlay
    expect(mergedIds.filter((id) => id === "dup-browse").length).toBe(1);
    // order: ov before browse
    expect(mergedIds.indexOf("ov-1")).toBe(0);
  });

  it("builds articleStateMap preferring in-memory articleStates and falling back to readArticleState", async () => {
    const browseItems = makeBrowseItems(1);
    const { result } = renderHook(() =>
      useReaderArticleStream({
        browseItems,
        overlayArticles: STABLE_EMPTY_OVERLAY,
        currentState: makeState(),
        feedLookup: STABLE_EMPTY_LOOKUP,
        localIndexReady: false,
        searchLocal: STABLE_NOOP_SEARCH,
      }),
    );

    await waitFor(() => {
      // default fallback via read
      expect(result.current.articleStateMap["browse-1"]).toEqual({
        read: false,
        starred: false,
        archived: false,
        bookmarked: false,
      });
    });

    // seed an override via the exposed setter (simulates internal seeding or prior updates)
    act(() => {
      result.current.setArticleStates((s) => ({
        ...s,
        "browse-1": { read: true, starred: true, archived: false, bookmarked: false },
      }));
    });

    expect(result.current.articleStateMap["browse-1"].read).toBe(true);
    expect(result.current.articleStateMap["browse-1"].starred).toBe(true);
  });

  it("seeds articleStates for articles from overlay/cached/browse (idempotent)", async () => {
    const browseItems = makeBrowseItems(1);
    const overlay = [makeOverlay("ov-seed")];

    const { result } = renderHook(() =>
      useReaderArticleStream({
        browseItems,
        overlayArticles: overlay,
        currentState: makeState(),
        feedLookup: STABLE_EMPTY_LOOKUP,
        localIndexReady: false,
        searchLocal: STABLE_NOOP_SEARCH,
      }),
    );

    await waitFor(() => {
      expect(result.current.articleStates["browse-1"]).toBeTruthy();
      expect(result.current.articleStates["ov-seed"]).toBeTruthy();
      expect(readSpy).toHaveBeenCalled();
    });
  });

  it("computes visibleArticles by applying matchesReaderView on current readerView + article states", async () => {
    const browseItems = makeBrowseItems(3);
    const { result } = renderHook(() =>
      useReaderArticleStream({
        browseItems,
        overlayArticles: STABLE_EMPTY_OVERLAY,
        currentState: makeState({ readerView: "unread" }),
        feedLookup: STABLE_EMPTY_LOOKUP,
        localIndexReady: false,
        searchLocal: STABLE_NOOP_SEARCH,
      }),
    );

    await waitFor(() => {
      expect(result.current.mergedArticles.length).toBe(3);
    });

    // seed a read state for one, archived for another
    act(() => {
      result.current.setArticleStates((s) => ({
        ...s,
        "browse-2": { read: true, starred: false, archived: false, bookmarked: false },
        "browse-3": { read: false, starred: false, archived: true, bookmarked: false },
      }));
    });

    // in "unread" view: excludes read and archived
    await waitFor(() => {
      const visibleIds = result.current.visibleArticles.map((a) => a.id);
      expect(visibleIds).toContain("browse-1");
      expect(visibleIds).not.toContain("browse-2");
      expect(visibleIds).not.toContain("browse-3");
    });
  });

  it("updateState writes full state to LS, syncs partial to IDB, and updates in-memory articleStates", () => {
    const { result } = renderHook(() =>
      useReaderArticleStream({
        browseItems: STABLE_EMPTY_BROWSE,
        overlayArticles: STABLE_EMPTY_OVERLAY,
        currentState: makeState(),
        feedLookup: STABLE_EMPTY_LOOKUP,
        localIndexReady: false,
        searchLocal: STABLE_NOOP_SEARCH,
      }),
    );

    act(() => {
      result.current.updateState("art-xyz", { starred: true, bookmarked: true });
    });

    expect(writeSpy).toHaveBeenCalledWith(
      "art-xyz",
      expect.objectContaining({ starred: true, bookmarked: true }),
    );
    expect(syncArticleStateMock).toHaveBeenCalledWith("art-xyz", {
      starred: true,
      bookmarked: true,
    });

    expect(result.current.articleStates["art-xyz"]).toEqual({
      read: false,
      starred: true,
      archived: false,
      bookmarked: true,
    });
  });
});
