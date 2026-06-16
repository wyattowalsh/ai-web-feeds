import { describe, expect, it } from "vitest";

import { CANONICAL_CATALOG_PATH, CANONICAL_READER_PATH } from "@/lib/reader-routes";
import type { FeedsWorkspaceInitialState } from "@/lib/reader-route-types";

import { buildReaderWorkspaceChrome } from "./build-reader-workspace-chrome";
import type { FeedStats } from "./types";

const baseState: FeedsWorkspaceInitialState = {
  query: "",
  sourceType: null,
  topics: [],
  verified: null,
  feedIds: [],
  sort: "latest",
  readerView: "latest",
  cursor: 0,
};

const stats: FeedStats = {
  total: 10,
  verified: 5,
  active: 8,
  hasVerificationMetadata: true,
  hasActivityMetadata: true,
  sourceTypeCount: 3,
  byType: {},
  topicCount: 4,
};

describe("buildReaderWorkspaceChrome", () => {
  it("builds tracked-source filter summary when no feeds are pinned", () => {
    const chrome = buildReaderWorkspaceChrome({
      currentState: baseState,
      feedLookup: new Map(),
      candidateFeedCount: 3,
      stats,
      corpusEmpty: false,
      overlayCount: 0,
      totalMatched: 12,
    });

    expect(chrome.filterSummary).toBe("3 active sources matching these filters");
    expect(chrome.visibleArticleCountLabel).toBe("12 article matches");
    expect(chrome.canClearArticleFilters).toBe(false);
    expect(chrome.canResetWorkspace).toBe(false);
    expect(chrome.resetWorkspaceHref).toBe(CANONICAL_READER_PATH);
    expect(chrome.catalogRecoveryHref).toBe(CANONICAL_CATALOG_PATH);
  });

  it("uses pinned-feed summary and enables workspace reset when filters are active", () => {
    const chrome = buildReaderWorkspaceChrome({
      currentState: {
        ...baseState,
        query: "agents",
        feedIds: ["feed-1", "feed-2"],
        readerView: "saved",
        cursor: 24,
      },
      feedLookup: new Map(),
      candidateFeedCount: 2,
      stats,
      corpusEmpty: false,
      overlayCount: 0,
      totalMatched: 1,
    });

    expect(chrome.filterSummary).toBe("2 pinned feeds");
    expect(chrome.canClearArticleFilters).toBe(true);
    expect(chrome.canResetWorkspace).toBe(true);
    expect(chrome.activeFilterChips.some((chip) => chip.label.includes("Search: agents"))).toBe(
      true,
    );
    expect(chrome.clearArticleFiltersHref).toContain("/reader");
  });

  it("labels empty corpus views with live overlay counts", () => {
    const chrome = buildReaderWorkspaceChrome({
      currentState: baseState,
      feedLookup: new Map(),
      candidateFeedCount: 0,
      stats: { ...stats, hasActivityMetadata: false },
      corpusEmpty: true,
      overlayCount: 1,
      totalMatched: 0,
    });

    expect(chrome.filterSummary).toBe("0 tracked sources matching these filters");
    expect(chrome.visibleArticleCountLabel).toBe("1 live post loaded");
  });
});
