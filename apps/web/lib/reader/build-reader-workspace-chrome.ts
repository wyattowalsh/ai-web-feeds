import type { FeedSource } from "@/lib/feeds-filters";
import { CANONICAL_CATALOG_PATH, CANONICAL_READER_PATH } from "@/lib/reader-routes";
import type { FeedsWorkspaceInitialState } from "@/lib/reader-route-types";

import { buildCurrentFilterChips } from "./filters";
import { buildReaderHref } from "./reader-href";
import type { FeedStats, FilterChip } from "./types";

export type BuildReaderWorkspaceChromeParams = {
  currentState: FeedsWorkspaceInitialState;
  feedLookup: Map<string, FeedSource>;
  candidateFeedCount: number;
  stats: FeedStats;
  corpusEmpty: boolean;
  overlayCount: number;
  totalMatched: number;
};

export type ReaderWorkspaceChrome = {
  filterSummary: string;
  visibleArticleCountLabel: string;
  activeFilterChips: FilterChip[];
  canClearArticleFilters: boolean;
  canResetWorkspace: boolean;
  clearArticleFiltersHref: string;
  resetWorkspaceHref: string;
  catalogRecoveryHref: string;
};

/**
 * Pure helpers for ReaderShell labels, chips, and recovery hrefs (wave 9 extraction).
 */
export function buildReaderWorkspaceChrome(
  params: BuildReaderWorkspaceChromeParams,
): ReaderWorkspaceChrome {
  const {
    currentState,
    feedLookup,
    candidateFeedCount,
    stats,
    corpusEmpty,
    overlayCount,
    totalMatched,
  } = params;

  const canClearArticleFilters =
    Boolean(currentState.query) || currentState.readerView !== "latest" || currentState.cursor > 0;
  const canResetWorkspace =
    canClearArticleFilters ||
    Boolean(currentState.sourceType) ||
    currentState.topics.length > 0 ||
    currentState.feedIds.length > 0 ||
    currentState.verified !== null ||
    currentState.sort !== "latest";

  const filterSummary =
    currentState.feedIds.length > 0
      ? `${currentState.feedIds.length} pinned feed${currentState.feedIds.length === 1 ? "" : "s"}`
      : `${candidateFeedCount} ${stats.hasActivityMetadata ? "active" : "tracked"} source${
          candidateFeedCount === 1 ? "" : "s"
        } matching these filters`;

  const visibleArticleCountLabel = corpusEmpty
    ? `${overlayCount} live post${overlayCount === 1 ? "" : "s"} loaded`
    : `${totalMatched} article match${totalMatched === 1 ? "" : "es"}`;

  return {
    filterSummary,
    visibleArticleCountLabel,
    activeFilterChips: buildCurrentFilterChips(currentState, feedLookup),
    canClearArticleFilters,
    canResetWorkspace,
    clearArticleFiltersHref: buildReaderHref(currentState, {
      q: null,
      reader_view: null,
      cursor: null,
    }),
    resetWorkspaceHref: CANONICAL_READER_PATH,
    catalogRecoveryHref: CANONICAL_CATALOG_PATH,
  };
}
