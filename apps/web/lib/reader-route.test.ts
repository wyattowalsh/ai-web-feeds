import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FeedSource } from "@/lib/feeds-filters";

const { browseArticleCorpusMock, getFeedStatsMock, loadFeedCatalogMock } = vi.hoisted(() => ({
  browseArticleCorpusMock: vi.fn(),
  getFeedStatsMock: vi.fn(),
  loadFeedCatalogMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/feeds", () => ({
  loadFeedCatalog: loadFeedCatalogMock,
  getFeedStats: getFeedStatsMock,
}));

vi.mock("@/lib/article-corpus", () => ({
  browseArticleCorpus: browseArticleCorpusMock,
}));

import { loadReaderRouteData, type ReaderPageSearchParams } from "./reader-route";

const source = readFileSync(join(process.cwd(), "lib/reader-route.ts"), "utf8");

const sources = [
  {
    id: "openai",
    url: "https://example.com/openai.xml",
    title: "OpenAI",
    source_type: "blog",
    verified: true,
    is_active: true,
    topics: ["agents"],
  },
] satisfies FeedSource[];

const stats = {
  total: 1,
  verified: 1,
  active: 1,
  hasVerificationMetadata: true,
  hasActivityMetadata: true,
  sourceTypeCount: 1,
  byType: { blog: 1 },
  topicCount: 1,
};

const EMPTY_INITIAL_STATE = {
  query: "",
  feedIds: [],
  sourceType: null,
  topics: [],
  verified: null,
  sort: "latest",
  readerView: "latest",
  cursor: 0,
  limit: 24,
} as const;

const browseResult = {
  items: [],
  next_cursor: null,
  total_matched: 0,
  cursor: 0,
  limit: 24,
  applied_query: null,
  applied_sort: "latest" as const,
  corpus: {
    generated_at: null,
    schema_version: "1",
    source_db: "catalog",
    article_count: 0,
    feed_count: 1,
    latest_published_at: null,
    freshness_watermark: null,
    is_empty: true,
  },
};

function resolvedSearchParams(
  searchParams: ReaderPageSearchParams = {},
): Promise<ReaderPageSearchParams> {
  return Promise.resolve(searchParams);
}

describe("loadReaderRouteData", () => {
  beforeEach(() => {
    loadFeedCatalogMock.mockReset();
    getFeedStatsMock.mockReset();
    browseArticleCorpusMock.mockReset();
    loadFeedCatalogMock.mockReturnValue({ sources });
    getFeedStatsMock.mockReturnValue(stats);
  });

  it("loads the catalog through loadFeedCatalog", () => {
    expect(source).toContain("loadFeedCatalog");
    expect(source).toContain("parseCursor");
    expect(source).toContain("parseInitialState");
    expect(source).toContain("parseLimit");
    expect(source).toContain("parseMode");
    expect(source).toContain("parseReaderView");
    expect(source).toContain("parseSort");
    expect(source).not.toContain("Math.random");
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });

  it("returns catalog rows and null browse without calling the corpus", async () => {
    browseArticleCorpusMock.mockRejectedValue(new Error("browse should not run"));

    const result = await loadReaderRouteData(resolvedSearchParams({ mode: "catalog" }));

    expect(loadFeedCatalogMock).toHaveBeenCalledTimes(1);
    expect(getFeedStatsMock).toHaveBeenCalledTimes(1);
    expect(getFeedStatsMock).toHaveBeenCalledWith(sources);
    expect(browseArticleCorpusMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      mode: "catalog",
      feeds: sources,
      stats,
      initialState: EMPTY_INITIAL_STATE,
      initialBrowse: null,
    });
  });

  it("returns the browse result for an empty non-catalog route", async () => {
    browseArticleCorpusMock.mockResolvedValue(browseResult);

    const result = await loadReaderRouteData(resolvedSearchParams());

    expect(browseArticleCorpusMock).toHaveBeenCalledTimes(1);
    expect(browseArticleCorpusMock).toHaveBeenCalledWith({
      q: "",
      feedIds: [],
      sourceType: undefined,
      topics: [],
      verified: undefined,
      sort: "latest",
      cursor: 0,
      limit: 24,
    });
    expect(result).toEqual({
      mode: "reader",
      feeds: sources,
      stats,
      initialState: EMPTY_INITIAL_STATE,
      initialBrowse: browseResult,
    });
  });

  it("passes parsed reader filters into browse and returns that result", async () => {
    const filteredBrowse = {
      ...browseResult,
      cursor: 7,
      limit: 100,
      applied_query: "OpenAI agents",
      applied_sort: "source" as const,
      total_matched: 2,
    };
    browseArticleCorpusMock.mockResolvedValue(filteredBrowse);

    const result = await loadReaderRouteData(
      resolvedSearchParams({
        mode: "reader",
        q: "  OpenAI   agents  ",
        feed: ["OpenAI", " OpenAI ", "", "anthropic"],
        source_type: " Blog ",
        topics: ["Agents", "ml, Agents"],
        verified: " FALSE ",
        sort: "source",
        reader_view: "archived",
        cursor: "7.8",
        limit: "100",
      }),
    );

    expect(browseArticleCorpusMock).toHaveBeenCalledWith({
      q: "OpenAI agents",
      feedIds: ["OpenAI", "anthropic"],
      sourceType: "Blog",
      topics: ["agents", "ml"],
      verified: false,
      sort: "source",
      cursor: 7,
      limit: 100,
    });
    expect(result.mode).toBe("reader");
    expect(result.feeds).toBe(sources);
    expect(result.stats).toBe(stats);
    expect(result.initialState).toEqual({
      query: "OpenAI agents",
      feedIds: ["OpenAI", "anthropic"],
      sourceType: "Blog",
      topics: ["agents", "ml"],
      verified: false,
      sort: "source",
      readerView: "archived",
      cursor: 7,
      limit: 100,
    });
    expect(result.initialBrowse).toBe(filteredBrowse);
  });

  it("turns a browse rejection into null browse while keeping catalog data", async () => {
    browseArticleCorpusMock.mockRejectedValue(new Error("corpus unavailable"));

    const result = await loadReaderRouteData(resolvedSearchParams({ mode: "reader" }));

    expect(browseArticleCorpusMock).toHaveBeenCalledTimes(1);
    expect(result.mode).toBe("reader");
    expect(result.feeds).toBe(sources);
    expect(result.stats).toBe(stats);
    expect(result.initialState).toEqual(EMPTY_INITIAL_STATE);
    expect(result.initialBrowse).toBeNull();
  });
});
