"use client";

import { cn } from "@/lib/cn";
import type { FeedSource } from "@/lib/feeds-filters";
import type { ReaderWorkspaceChrome } from "@/lib/reader/build-reader-workspace-chrome";
import type { ReaderArticleState, WorkspaceArticle } from "@/lib/reader";
import type {
  FeedsWorkspaceInitialBrowse,
  FeedsWorkspaceInitialState,
} from "@/lib/reader-route-types";
import type { ReaderShellStat } from "@/components/reader/reader-shell-header";
import type {
  ReaderFilterFormProps,
  ReaderFilterMobileRail,
} from "@/hooks/use-reader-filter-draft";

import { getFilteredEmptyHeading } from "@/lib/reader/empty-state-copy";
import { ReaderArticleStream } from "@/components/reader/reader-article-stream";
import { ReaderCorpusEmpty } from "@/components/reader/reader-corpus-empty";
import { ReaderFilterRail } from "@/components/reader/reader-filter-rail";
import { ReaderPreviewPane } from "@/components/reader/reader-preview-pane";
import { ReaderShellHeader } from "@/components/reader/reader-shell-header";

export type ReaderShellWorkspaceProps = {
  corpusEmpty: boolean;
  overlayCount: number;
  refreshing: boolean;
  refreshError: string | null;
  candidateFeedCount: number;
  onLoadLiveSample: () => void;
  liveStatusText: string | null;
  readerStats: ReaderShellStat[];
  onRefreshLatest: () => void;
  chrome: ReaderWorkspaceChrome;
  browse: FeedsWorkspaceInitialBrowse;
  filterFormProps: ReaderFilterFormProps;
  mobileRail: ReaderFilterMobileRail;
  currentState: FeedsWorkspaceInitialState;
  loading: boolean;
  error: string | null;
  visibleArticles: WorkspaceArticle[];
  articleStateMap: Record<string, ReaderArticleState>;
  selectedArticle: WorkspaceArticle | null;
  selectedArticleState: ReaderArticleState;
  feedLookup: Map<string, FeedSource>;
  layout: "cards" | "list" | "compact";
  showSummaries: boolean;
  statsTotal: number;
  statsTopicCount: number;
  onSelectArticle: (articleId: string) => void;
  onUpdateState: (articleId: string, partial: Partial<ReaderArticleState>) => void;
  onClosePreview: () => void;
  onFilterChip: (overrides: Record<string, string | string[] | null | undefined>) => void;
  onResetDrafts: () => void;
  onPaginate: (cursor: string | null) => void;
};

export function ReaderShellWorkspace({
  corpusEmpty,
  overlayCount,
  refreshing,
  refreshError,
  candidateFeedCount,
  onLoadLiveSample,
  liveStatusText,
  readerStats,
  onRefreshLatest,
  chrome,
  browse,
  filterFormProps,
  mobileRail,
  currentState,
  loading,
  error,
  visibleArticles,
  articleStateMap,
  selectedArticle,
  selectedArticleState,
  feedLookup,
  layout,
  showSummaries,
  statsTotal,
  statsTopicCount,
  onSelectArticle,
  onUpdateState,
  onClosePreview,
  onFilterChip,
  onResetDrafts,
  onPaginate,
}: ReaderShellWorkspaceProps) {
  const showCorpusEmptyPanel = corpusEmpty && overlayCount === 0 && !refreshing;
  const selectedArticleSource = selectedArticle ? feedLookup.get(selectedArticle.feed_id) : null;

  return (
    <div className="reader-shell space-y-5">
      <ReaderShellHeader
        corpusEmpty={corpusEmpty}
        overlayCount={overlayCount}
        refreshing={refreshing}
        liveStatusText={liveStatusText}
        readerStats={readerStats}
        onRefreshLatest={onRefreshLatest}
      />

      <div
        data-testid="reader-workspace-grid"
        className={cn(
          "grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]",
          selectedArticle && "xl:grid-cols-[18rem_minmax(0,1fr)_22rem]",
          selectedArticle && "2xl:grid-cols-[20rem_minmax(0,1fr)_24rem]",
        )}
      >
        <ReaderFilterRail
          variant="desktop"
          filters={filterFormProps}
          filterSummary={chrome.filterSummary}
          visibleArticleCountLabel={chrome.visibleArticleCountLabel}
          visibleCount={visibleArticles.length}
          corpusArticleCount={browse.corpus.article_count}
          corpusFeedCount={browse.corpus.feed_count}
          catalogTotal={statsTotal}
          catalogTopicCount={statsTopicCount}
        />

        <section className="space-y-5">
          <ReaderFilterRail
            variant="mobile"
            filters={filterFormProps}
            mobileOpen={mobileRail.open}
            onMobileOpenChange={mobileRail.onOpenChange}
            activeFilterCount={chrome.activeFilterChips.length}
          />

          <ReaderArticleStream
            query={currentState.query}
            filterSummary={chrome.filterSummary}
            refreshError={refreshError}
            error={error}
            activeFilterChips={chrome.activeFilterChips}
            loading={loading}
            refreshing={refreshing}
            visibleArticles={visibleArticles}
            articleStateMap={articleStateMap}
            selectedArticleId={selectedArticle?.id ?? null}
            feedLookup={feedLookup}
            layout={layout}
            showSummaries={showSummaries}
            browseCursor={browse.cursor}
            browseLimit={browse.limit}
            browseNextCursor={browse.next_cursor}
            canClearArticleFilters={chrome.canClearArticleFilters}
            canResetWorkspace={chrome.canResetWorkspace}
            clearArticleFiltersHref={chrome.clearArticleFiltersHref}
            resetWorkspaceHref={chrome.resetWorkspaceHref}
            catalogRecoveryHref={chrome.catalogRecoveryHref}
            onSelectArticle={onSelectArticle}
            onUpdateState={onUpdateState}
            onClosePreview={onClosePreview}
            onFilterChip={onFilterChip}
            onResetDrafts={onResetDrafts}
            onPaginate={onPaginate}
            corpusEmptyPanel={
              showCorpusEmptyPanel ? (
                <ReaderCorpusEmpty
                  refreshError={refreshError}
                  refreshing={refreshing}
                  candidateFeedCount={candidateFeedCount}
                  onLoadLiveSample={onLoadLiveSample}
                  headingOverride={getFilteredEmptyHeading(currentState)}
                />
              ) : undefined
            }
          />
        </section>

        {selectedArticle ? (
          <div className="hidden xl:block xl:sticky xl:top-24 xl:self-start">
            <ReaderPreviewPane
              article={selectedArticle}
              source={selectedArticleSource}
              state={selectedArticleState}
              variant="panel"
              onClose={onClosePreview}
              onToggleState={(partial) => {
                if (!selectedArticle) {
                  return;
                }
                onUpdateState(selectedArticle.id, partial);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
