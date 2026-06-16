import { describe, expect, it } from "vitest";
import { Clock3, Filter, Newspaper, RefreshCcw } from "lucide-react";

import type { FeedsWorkspaceInitialState } from "@/lib/reader-route-types";

import { buildReaderShellPresentation } from "./build-reader-shell-presentation";
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

describe("buildReaderShellPresentation", () => {
  it("returns chrome, stats, and live status together", () => {
    const result = buildReaderShellPresentation({
      currentState: baseState,
      feedLookup: new Map(),
      candidateFeedCount: 3,
      stats,
      corpusEmpty: false,
      overlayCount: 0,
      totalMatched: 12,
      corpusGeneratedAt: "2026-06-01T00:00:00Z",
      corpusLatestPublishedAt: null,
      visibleCount: 5,
      liveProgress: null,
    });

    expect(result.chrome.filterSummary).toContain("3 active sources");
    expect(result.readerStats).toHaveLength(4);
    expect(result.readerStats[0].icon).toBe(Clock3);
    expect(result.readerStats[1].icon).toBe(Newspaper);
    expect(result.readerStats[2].icon).toBe(Filter);
    expect(result.readerStats[3].icon).toBe(RefreshCcw);
    expect(result.liveStatusText).toBeNull();
  });

  it("labels empty corpus overlay views", () => {
    const result = buildReaderShellPresentation({
      currentState: baseState,
      feedLookup: new Map(),
      candidateFeedCount: 2,
      stats,
      corpusEmpty: true,
      overlayCount: 4,
      totalMatched: 0,
      corpusGeneratedAt: null,
      corpusLatestPublishedAt: null,
      visibleCount: 4,
      liveProgress: null,
    });

    expect(result.chrome.visibleArticleCountLabel).toBe("4 live posts loaded");
    expect(result.readerStats[1].value).toContain("4");
  });

  it("builds live status text from progress", () => {
    const result = buildReaderShellPresentation({
      currentState: baseState,
      feedLookup: new Map(),
      candidateFeedCount: 1,
      stats,
      corpusEmpty: false,
      overlayCount: 0,
      totalMatched: 1,
      corpusGeneratedAt: null,
      corpusLatestPublishedAt: null,
      visibleCount: 1,
      liveProgress: {
        totalSources: 5,
        successfulSources: 2,
        failedSources: 0,
        completed: false,
      },
    });

    expect(result.liveStatusText).toBe("2 sources checked · 3 loading · 1 posts shown");
  });
});
