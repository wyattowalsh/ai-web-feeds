import { describe, expect, it } from "vitest";
import { Clock3, Filter, Newspaper, RefreshCcw } from "lucide-react";

import type { FeedStats, LiveStreamProgress } from "./types";
import { buildLiveStatusText, buildReaderShellStats } from "./build-reader-shell-stats";
import { formatSnapshotTimestamp } from "./format";
import { LIVE_REFRESH_SAMPLE_FEED_LIMIT } from "./constants";
import type { ReaderShellStat } from "@/components/reader/reader-shell-header";

function makeStats(overrides: Partial<FeedStats> = {}): FeedStats {
  return {
    total: 42,
    verified: 17,
    active: 31,
    hasVerificationMetadata: true,
    hasActivityMetadata: true,
    sourceTypeCount: 4,
    byType: { blog: 20, newsletter: 11 },
    topicCount: 9,
    ...overrides,
  };
}

describe("buildReaderShellStats", () => {
  it("returns exactly 4 stats in order with ReaderShellStat shape", () => {
    const result = buildReaderShellStats({
      corpusEmpty: false,
      corpusGeneratedAt: "2026-06-01T00:00:00Z",
      corpusLatestPublishedAt: null,
      visibleCount: 12,
      overlayCount: 3,
      totalMatched: 45,
      candidateFeedCount: 7,
      stats: makeStats(),
    });

    expect(result).toHaveLength(4);
    expect(result[0].label).toBe("Freshness");
    expect(result[1].label).toBe("Visible");
    expect(result[2].label).toBe("Sources");
    expect(result[3].label).toBe("New");
    // type check via assignment
    const asTyped: ReaderShellStat[] = result;
    expect(asTyped).toBe(result);
  });

  it("uses Clock3, Newspaper, Filter, RefreshCcw icons respectively (LucideIcon refs)", () => {
    const result = buildReaderShellStats({
      corpusEmpty: false,
      corpusGeneratedAt: null,
      corpusLatestPublishedAt: null,
      visibleCount: 0,
      overlayCount: 0,
      totalMatched: 0,
      candidateFeedCount: 0,
      stats: makeStats(),
    });

    expect(result[0].icon).toBe(Clock3);
    expect(result[1].icon).toBe(Newspaper);
    expect(result[2].icon).toBe(Filter);
    expect(result[3].icon).toBe(RefreshCcw);
  });

  it("corpus empty: sets Live mode, live notes, uses candidateFeedCount for sources with min(LIVE limit)", () => {
    const candidateCount = LIVE_REFRESH_SAMPLE_FEED_LIMIT + 5; // 23
    const result = buildReaderShellStats({
      corpusEmpty: true,
      corpusGeneratedAt: "2026-01-01T00:00:00Z",
      corpusLatestPublishedAt: "2026-01-01T00:00:00Z",
      visibleCount: 5,
      overlayCount: 5,
      totalMatched: 99,
      candidateFeedCount: candidateCount,
      stats: makeStats(),
    });

    expect(result[0]).toEqual({
      label: "Freshness",
      value: "Live mode",
      note: "Recent posts loaded live",
      icon: Clock3,
    });
    expect(result[1]).toEqual({
      label: "Visible",
      value: "5",
      note: "5 live posts",
      icon: Newspaper,
    });
    expect(result[2]).toEqual({
      label: "Sources",
      value: String(candidateCount),
      note: `${LIVE_REFRESH_SAMPLE_FEED_LIMIT} source live sample`,
      icon: Filter,
    });
    expect(result[3]).toEqual({
      label: "New",
      value: "5",
      note: "Live posts in stream",
      icon: RefreshCcw,
    });
  });

  it("corpus empty with singular live post note", () => {
    const result = buildReaderShellStats({
      corpusEmpty: true,
      corpusGeneratedAt: null,
      corpusLatestPublishedAt: null,
      visibleCount: 1,
      overlayCount: 1,
      totalMatched: 0,
      candidateFeedCount: 2,
      stats: makeStats(),
    });

    expect(result[1].note).toBe("1 live post");
    expect(result[2].note).toBe("2 source live sample");
  });

  it("non-empty with generated_at: uses formatted timestamp for freshness, 'Prepared posts ready' note", () => {
    const generated = "2026-06-10T15:45:00.000Z";
    const result = buildReaderShellStats({
      corpusEmpty: false,
      corpusGeneratedAt: generated,
      corpusLatestPublishedAt: "2026-06-09T00:00:00Z",
      visibleCount: 8,
      overlayCount: 2,
      totalMatched: 123,
      candidateFeedCount: 10,
      stats: makeStats(),
    });

    expect(result[0].value).toBe(formatSnapshotTimestamp(generated));
    expect(result[0].note).toBe("Prepared posts ready");
    expect(result[1].note).toBe("123 matches");
    expect(result[2].value).toBe("31"); // active due to hasActivity
  });

  it("non-empty without generated_at but with latest_published: 'Live sample ready', formats latest", () => {
    const latest = "2026-05-20T08:00:00Z";
    const result = buildReaderShellStats({
      corpusEmpty: false,
      corpusGeneratedAt: null,
      corpusLatestPublishedAt: latest,
      visibleCount: 2,
      overlayCount: 0,
      totalMatched: 2,
      candidateFeedCount: 5,
      stats: makeStats({ hasActivityMetadata: false, hasVerificationMetadata: false }),
    });

    expect(result[0].value).toBe(formatSnapshotTimestamp(latest));
    expect(result[0].note).toBe("Live sample ready");
    expect(result[1].note).toBe("2 matches");
    expect(result[2].value).toBe("42"); // falls back to total
    expect(result[2].note).toBe("Verification metadata is not present in this catalog"); // hasVerification false via override
  });

  it("non-empty with no timestamps at all: value 'Waiting', note 'Live sample ready'", () => {
    const result = buildReaderShellStats({
      corpusEmpty: false,
      corpusGeneratedAt: null,
      corpusLatestPublishedAt: null,
      visibleCount: 0,
      overlayCount: 0,
      totalMatched: 0,
      candidateFeedCount: 0,
      stats: makeStats({ hasVerificationMetadata: true, verified: 0 }),
    });

    expect(result[0].value).toBe("Waiting");
    expect(result[0].note).toBe("Live sample ready");
  });

  it("New stat notes vary correctly with overlay and corpusEmpty", () => {
    const base = {
      corpusGeneratedAt: "2026-06-01T00:00:00Z",
      corpusLatestPublishedAt: null,
      visibleCount: 10,
      totalMatched: 10,
      candidateFeedCount: 4,
      stats: makeStats(),
    };

    const withLiveEmpty = buildReaderShellStats({
      ...base,
      corpusEmpty: true,
      overlayCount: 4,
    });
    expect(withLiveEmpty[3]).toMatchObject({
      value: "4",
      note: "Live posts in stream",
    });

    const withLivePrepared = buildReaderShellStats({
      ...base,
      corpusEmpty: false,
      overlayCount: 1,
    });
    expect(withLivePrepared[3]).toMatchObject({
      value: "1",
      note: "Layered above prepared posts",
    });

    const noNew = buildReaderShellStats({
      ...base,
      corpusEmpty: false,
      overlayCount: 0,
    });
    expect(noNew[3]).toMatchObject({ value: "0", note: "No live additions" });
  });

  it("pluralization for matches and posts in notes", () => {
    const r1 = buildReaderShellStats({
      corpusEmpty: false,
      corpusGeneratedAt: null,
      corpusLatestPublishedAt: null,
      visibleCount: 0,
      overlayCount: 0,
      totalMatched: 1,
      candidateFeedCount: 0,
      stats: makeStats(),
    });
    expect(r1[1].note).toBe("1 match");

    const r2 = buildReaderShellStats({
      corpusEmpty: false,
      corpusGeneratedAt: null,
      corpusLatestPublishedAt: null,
      visibleCount: 0,
      overlayCount: 0,
      totalMatched: 2,
      candidateFeedCount: 0,
      stats: makeStats(),
    });
    expect(r2[1].note).toBe("2 matches");
  });
});

describe("buildLiveStatusText", () => {
  it("returns null when no liveProgress", () => {
    expect(buildLiveStatusText({ liveProgress: null, visibleCount: 10 })).toBeNull();
    expect(buildLiveStatusText({ liveProgress: null, visibleCount: 0 })).toBeNull();
  });

  it("formats progress string with pending calc and visibleCount", () => {
    const progress: LiveStreamProgress = {
      totalSources: 10,
      successfulSources: 4,
      failedSources: 1,
      completed: false,
    };
    const text = buildLiveStatusText({ liveProgress: progress, visibleCount: 7 });
    expect(text).toBe("5 sources checked · 5 loading · 7 posts shown");
  });

  it("pending never negative (clamped at 0)", () => {
    const progress: LiveStreamProgress = {
      totalSources: 3,
      successfulSources: 2,
      failedSources: 2,
      completed: true,
    };
    const text = buildLiveStatusText({ liveProgress: progress, visibleCount: 0 });
    expect(text).toBe("4 sources checked · 0 loading · 0 posts shown");
  });

  it("uses visibleCount even when 0 or 1 (no plural in this text)", () => {
    const p: LiveStreamProgress = {
      totalSources: 1,
      successfulSources: 1,
      failedSources: 0,
      completed: true,
    };
    expect(buildLiveStatusText({ liveProgress: p, visibleCount: 0 })).toBe(
      "1 sources checked · 0 loading · 0 posts shown",
    );
    expect(buildLiveStatusText({ liveProgress: p, visibleCount: 1 })).toBe(
      "1 sources checked · 0 loading · 1 posts shown",
    );
  });
});
