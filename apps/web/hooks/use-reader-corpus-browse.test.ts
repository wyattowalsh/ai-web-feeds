import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";

import type {
  FeedsWorkspaceInitialBrowse,
  FeedsWorkspaceInitialState,
} from "@/lib/reader-route-types";

import { useReaderCorpusBrowse } from "./use-reader-corpus-browse";

function makeInitialBrowse(): FeedsWorkspaceInitialBrowse {
  return {
    items: [],
    next_cursor: null,
    total_matched: 0,
    cursor: 0,
    limit: 24,
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
  };
}

function makeState(
  overrides: Partial<FeedsWorkspaceInitialState> = {},
): FeedsWorkspaceInitialState {
  return {
    query: "",
    feedIds: [],
    sourceType: null,
    topics: [],
    verified: null,
    sort: "latest",
    readerView: "latest",
    cursor: 0,
    limit: 24,
    ...overrides,
  };
}

describe("useReaderCorpusBrowse", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("skips fetch on initial mount when searchParamsString matches the query part of initialParamsString (preserves firstLoadRef skip logic)", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const initialBrowse = makeInitialBrowse();
    const currentState = makeState();
    // buildReaderHref style: full path?query
    const initialParamsString = "/reader?topics=ai,ml";
    // searchParams.toString() style
    const searchParamsString = "topics=ai,ml";

    const onBrowseStart = vi.fn();

    const { result } = renderHook(() =>
      useReaderCorpusBrowse({
        currentState,
        initialParamsString,
        searchParamsString,
        initialBrowse,
        onBrowseStart,
      }),
    );

    // Skip logic must prevent any fetch and any onBrowseStart call
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onBrowseStart).not.toHaveBeenCalled();

    // State remains the initialBrowse, loading false, no error
    expect(result.current.browse).toBe(initialBrowse);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();

    // setBrowse should be a function (for future controlled updates)
    expect(typeof result.current.setBrowse).toBe("function");
  });

  it("performs corpus fetch (and calls onBrowseStart) when search params differ from initial on first load", async () => {
    const payload: FeedsWorkspaceInitialBrowse = {
      ...makeInitialBrowse(),
      total_matched: 5,
      items: [
        {
          id: "a1",
          feed_id: "f1",
          feed_title: "Feed 1",
          title: "Title 1",
          link: "https://ex.com/1",
          summary: null,
          content_html: null,
          author: null,
          published_at: null,
          topics: [],
          source_topics: [],
          raw_categories: [],
          source_type: "blog",
          verified: false,
          is_active: true,
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const initialBrowse = makeInitialBrowse();
    const currentState = makeState({ query: "llm" });
    const initialParamsString = "/reader";
    const searchParamsString = "q=llm"; // differs -> do not skip

    const onBrowseStart = vi.fn();

    const { result } = renderHook(() =>
      useReaderCorpusBrowse({
        currentState,
        initialParamsString,
        searchParamsString,
        initialBrowse,
        onBrowseStart,
      }),
    );

    // onBrowseStart called before fetch setup
    expect(onBrowseStart).toHaveBeenCalledTimes(1);

    // fetch should be called with constructed /api/articles?...
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toBe("/api/articles?q=llm");

    // Eventually browse updates to payload (async)
    await waitFor(() => {
      expect(result.current.browse.total_matched).toBe(5);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
});
