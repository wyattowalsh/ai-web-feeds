"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { FeedCatalog } from "./feed-catalog";

import { cn } from "@/lib/cn";
import type { FeedSource } from "@/lib/feeds-filters";
import type {
  FeedsWorkspaceInitialBrowse,
  FeedsWorkspaceInitialState,
  FeedsWorkspaceMode,
} from "@/lib/reader-route-types";
import {
  DEFAULT_PAGE_LIMIT,
  buildLiveStatusText,
  buildReaderShellStats,
  buildReaderWorkspaceChrome,
  getSourceTypesFromFeeds,
  matchesFeedSlice,
  type FeedStats,
  type WorkspaceArticle,
} from "@/lib/reader";
import { ReaderArticleStream } from "@/components/reader/reader-article-stream";
import { ReaderCorpusEmpty } from "@/components/reader/reader-corpus-empty";
import { ReaderFilterRail } from "@/components/reader/reader-filter-rail";
import { ReaderPreviewPane } from "@/components/reader/reader-preview-pane";
import { ReaderShellHeader } from "@/components/reader/reader-shell-header";
import { useLocalSearchIndex } from "@/hooks/use-local-search-index";
import { useReaderArticleStream } from "@/hooks/use-reader-article-stream";
import { useReaderCorpusBrowse } from "@/hooks/use-reader-corpus-browse";
import { useReaderFilterDraft } from "@/hooks/use-reader-filter-draft";
import { useReaderLiveRefresh } from "@/hooks/use-reader-live-refresh";
import { useReaderPreview } from "@/hooks/use-reader-preview";
import { useReaderRouteState } from "@/hooks/use-reader-route-state";
import { useReaderShortcutHandlers } from "@/hooks/use-reader-shortcut-handlers";
import { useReaderPreferences } from "@/lib/use-reader-preferences";

type FeedsWorkspaceClientProps = {
  mode: FeedsWorkspaceMode;
  feeds: FeedSource[];
  stats: FeedStats;
  initialState: FeedsWorkspaceInitialState;
  initialBrowse: FeedsWorkspaceInitialBrowse | null;
};

export function ReaderShell({
  feeds,
  stats,
  initialState,
  initialBrowse,
}: {
  feeds: FeedSource[];
  stats: FeedStats;
  initialState: FeedsWorkspaceInitialState;
  initialBrowse: FeedsWorkspaceInitialBrowse;
}) {
  const router = useRouter();
  const { preferences, update } = useReaderPreferences();
  const { currentState, updateUrl, initialParamsString, searchParamsString } = useReaderRouteState({
    initialState,
    stats,
  });

  const { ready: localIndexReady, search: searchLocal } = useLocalSearchIndex();
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const overlayClearRef = useRef<(() => void) | null>(null);
  const mergedArticlesRef = useRef<WorkspaceArticle[]>([]);
  const queryInputRef = useRef<HTMLInputElement>(null);

  const candidateFeeds = useMemo(
    () =>
      feeds.filter((feed) =>
        matchesFeedSlice(feed, {
          feedIds: currentState.feedIds,
          sourceType: currentState.sourceType,
          topics: currentState.topics,
          verified: currentState.verified,
        }),
      ),
    [
      currentState.feedIds,
      currentState.sourceType,
      currentState.topics,
      currentState.verified,
      feeds,
    ],
  );

  const { browse, loading, error } = useReaderCorpusBrowse({
    currentState,
    initialParamsString,
    searchParamsString,
    initialBrowse,
    onBrowseStart: () => overlayClearRef.current?.(),
  });

  const {
    refreshing,
    refreshError,
    liveProgress,
    overlayArticles,
    setOverlayArticles,
    refreshLatest,
  } = useReaderLiveRefresh({
    candidateFeeds,
    feedIds: currentState.feedIds,
    query: currentState.query,
    sort: currentState.sort,
    mergedArticles: mergedArticlesRef.current,
  });

  overlayClearRef.current = () => setOverlayArticles([]);

  const feedLookup = useMemo(
    () =>
      new Map(
        feeds
          .filter((feed): feed is FeedSource & { id: string } => typeof feed.id === "string")
          .map((feed) => [feed.id, feed]),
      ),
    [feeds],
  );

  const { articleStateMap, mergedArticles, visibleArticles, updateState } = useReaderArticleStream({
    browseItems: browse.items,
    overlayArticles,
    currentState,
    feedLookup,
    localIndexReady,
    searchLocal,
  });

  mergedArticlesRef.current = mergedArticles;

  const {
    previewArticleId,
    setPreviewArticleId,
    selectedArticle,
    selectedArticleState,
    clearPreview,
  } = useReaderPreview({ visibleArticles, articleStateMap });

  const { filterFormProps, resetDrafts } = useReaderFilterDraft({
    currentState,
    feeds,
    stats,
    updateUrl,
    layout: preferences.layout,
    onLayoutChange: (next) => update({ layout: next }),
    queryInputRef,
    onBeforeNavigate: clearPreview,
    onCloseMobileControls: () => setMobileControlsOpen(false),
  });

  const corpusEmpty = browse.corpus.is_empty;
  const workspaceChrome = buildReaderWorkspaceChrome({
    currentState,
    feedLookup,
    candidateFeedCount: candidateFeeds.length,
    stats,
    corpusEmpty,
    overlayCount: overlayArticles.length,
    totalMatched: browse.total_matched,
  });

  const readerStats = buildReaderShellStats({
    corpusEmpty,
    corpusGeneratedAt: browse.corpus.generated_at,
    corpusLatestPublishedAt: browse.corpus.latest_published_at,
    visibleCount: visibleArticles.length,
    overlayCount: overlayArticles.length,
    totalMatched: browse.total_matched,
    candidateFeedCount: candidateFeeds.length,
    stats,
  });
  const liveStatusText = buildLiveStatusText({
    liveProgress,
    visibleCount: visibleArticles.length,
  });

  const selectedArticleSource = selectedArticle ? feedLookup.get(selectedArticle.feed_id) : null;

  const { handleSelectArticle } = useReaderShortcutHandlers({
    visibleArticles,
    previewArticleId,
    setPreviewArticleId,
    selectedArticle,
    selectedArticleState,
    updateState,
    refreshLatest,
    queryInputRef,
    router,
    updateUrl,
  });

  if (corpusEmpty && overlayArticles.length === 0 && !refreshing) {
    return (
      <ReaderCorpusEmpty
        refreshError={refreshError}
        refreshing={refreshing}
        candidateFeedCount={candidateFeeds.length}
        onLoadLiveSample={() => void refreshLatest(true)}
      />
    );
  }

  return (
    <div className="reader-shell space-y-5">
      <ReaderShellHeader
        corpusEmpty={corpusEmpty}
        overlayCount={overlayArticles.length}
        refreshing={refreshing}
        liveStatusText={liveStatusText}
        readerStats={readerStats}
        onRefreshLatest={() => void refreshLatest(true)}
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
          filterSummary={workspaceChrome.filterSummary}
          visibleArticleCountLabel={workspaceChrome.visibleArticleCountLabel}
          visibleCount={visibleArticles.length}
          corpusArticleCount={browse.corpus.article_count}
          corpusFeedCount={browse.corpus.feed_count}
          catalogTotal={stats.total}
          catalogTopicCount={stats.topicCount}
        />

        <section className="space-y-5">
          <ReaderFilterRail
            variant="mobile"
            filters={filterFormProps}
            mobileOpen={mobileControlsOpen}
            onMobileOpenChange={setMobileControlsOpen}
            activeFilterCount={workspaceChrome.activeFilterChips.length}
          />

          <ReaderArticleStream
            query={currentState.query}
            filterSummary={workspaceChrome.filterSummary}
            refreshError={refreshError}
            error={error}
            activeFilterChips={workspaceChrome.activeFilterChips}
            loading={loading}
            refreshing={refreshing}
            visibleArticles={visibleArticles}
            articleStateMap={articleStateMap}
            selectedArticleId={selectedArticle?.id ?? null}
            feedLookup={feedLookup}
            layout={preferences.layout}
            showSummaries={preferences.showSummaries}
            browseCursor={browse.cursor}
            browseLimit={browse.limit}
            browseNextCursor={browse.next_cursor}
            canClearArticleFilters={workspaceChrome.canClearArticleFilters}
            canResetWorkspace={workspaceChrome.canResetWorkspace}
            clearArticleFiltersHref={workspaceChrome.clearArticleFiltersHref}
            resetWorkspaceHref={workspaceChrome.resetWorkspaceHref}
            catalogRecoveryHref={workspaceChrome.catalogRecoveryHref}
            onSelectArticle={handleSelectArticle}
            onUpdateState={updateState}
            onClosePreview={clearPreview}
            onFilterChip={updateUrl}
            onResetDrafts={resetDrafts}
            onPaginate={(cursor) => updateUrl({ cursor })}
          />
        </section>

        {selectedArticle ? (
          <div className="hidden xl:block xl:sticky xl:top-24 xl:self-start">
            <ReaderPreviewPane
              article={selectedArticle}
              source={selectedArticleSource}
              state={selectedArticleState}
              variant="panel"
              onClose={clearPreview}
              onToggleState={(partial) => {
                if (!selectedArticle) {
                  return;
                }
                updateState(selectedArticle.id, partial);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FeedsWorkspaceClient({
  mode,
  feeds,
  stats,
  initialState,
  initialBrowse,
}: FeedsWorkspaceClientProps) {
  const sourceTypes = useMemo(() => getSourceTypesFromFeeds(feeds), [feeds]);

  if (mode === "catalog") {
    return (
      <FeedCatalog
        feeds={feeds}
        sourceTypes={sourceTypes}
        initialQuery={initialState.query}
        initialSourceType={initialState.sourceType}
        initialTopics={initialState.topics}
        initialVerified={initialState.verified}
      />
    );
  }

  return (
    <ReaderShell
      feeds={feeds}
      stats={stats}
      initialState={initialState}
      initialBrowse={
        initialBrowse ?? {
          items: [],
          next_cursor: null,
          total_matched: 0,
          cursor: 0,
          limit: DEFAULT_PAGE_LIMIT,
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
        }
      }
    />
  );
}
