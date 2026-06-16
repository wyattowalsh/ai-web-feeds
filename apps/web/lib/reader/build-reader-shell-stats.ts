import { Clock3, Filter, Newspaper, RefreshCcw } from "lucide-react";

import type { FeedStats, LiveStreamProgress } from "./types";
import { LIVE_REFRESH_SAMPLE_FEED_LIMIT } from "./constants";
import { formatSnapshotTimestamp } from "./format";
import type { ReaderShellStat } from "@/components/reader/reader-shell-header";

export type BuildReaderShellStatsParams = {
  corpusEmpty: boolean;
  corpusGeneratedAt: string | null;
  corpusLatestPublishedAt: string | null;
  visibleCount: number;
  overlayCount: number;
  totalMatched: number;
  candidateFeedCount: number;
  stats: FeedStats;
};

export type BuildLiveStatusTextParams = {
  liveProgress: LiveStreamProgress | null;
  visibleCount: number;
};

export function buildReaderShellStats(params: BuildReaderShellStatsParams): ReaderShellStat[] {
  const {
    corpusEmpty,
    corpusGeneratedAt,
    corpusLatestPublishedAt,
    visibleCount,
    overlayCount,
    totalMatched,
    candidateFeedCount,
    stats,
  } = params;

  const freshnessTimestamp = corpusGeneratedAt ?? corpusLatestPublishedAt ?? null;

  const sourceStatValue = stats.hasActivityMetadata ? stats.active : stats.total;
  const sourceStatNote = stats.hasVerificationMetadata
    ? `${stats.verified} verified sources currently tracked`
    : "Verification metadata is not present in this catalog";

  return [
    {
      label: "Freshness",
      value: corpusEmpty
        ? "Live mode"
        : freshnessTimestamp
          ? formatSnapshotTimestamp(freshnessTimestamp)
          : "Waiting",
      note: corpusEmpty
        ? "Recent posts loaded live"
        : corpusGeneratedAt
          ? "Prepared posts ready"
          : "Live sample ready",
      icon: Clock3,
    },
    {
      label: "Visible",
      value: String(visibleCount),
      note: corpusEmpty
        ? `${overlayCount} live post${overlayCount === 1 ? "" : "s"}`
        : `${totalMatched} match${totalMatched === 1 ? "" : "es"}`,
      icon: Newspaper,
    },
    {
      label: "Sources",
      value: String(corpusEmpty ? candidateFeedCount : sourceStatValue),
      note: corpusEmpty
        ? `${Math.min(candidateFeedCount, LIVE_REFRESH_SAMPLE_FEED_LIMIT)} source live sample`
        : sourceStatNote,
      icon: Filter,
    },
    {
      label: "New",
      value: String(overlayCount),
      note:
        overlayCount > 0
          ? corpusEmpty
            ? "Live posts in stream"
            : "Layered above prepared posts"
          : "No live additions",
      icon: RefreshCcw,
    },
  ];
}

export function buildLiveStatusText(params: BuildLiveStatusTextParams): string | null {
  const { liveProgress, visibleCount } = params;
  if (!liveProgress) {
    return null;
  }
  const livePendingSources = Math.max(
    liveProgress.totalSources - liveProgress.successfulSources - liveProgress.failedSources,
    0,
  );
  return `${
    liveProgress.successfulSources + liveProgress.failedSources
  } sources checked · ${livePendingSources} loading · ${visibleCount} posts shown`;
}
