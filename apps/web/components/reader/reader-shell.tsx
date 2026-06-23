"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { FeedSource } from "@/lib/feeds-filters";
import type { FeedStats } from "@/lib/reader";
import { useSuspendReaderShortcuts } from "@/hooks/use-suspend-reader-shortcuts";
import { buildReaderWorkspaceChrome } from "@/lib/reader/build-reader-workspace-chrome";
import { buildLiveStatusText, buildReaderShellStats } from "@/lib/reader/build-reader-shell-stats";
import type {
  FeedsWorkspaceInitialBrowse,
  FeedsWorkspaceInitialState,
} from "@/lib/reader-route-types";
import { useLocalSearchIndex } from "@/hooks/use-local-search-index";
import { useReaderFeedSlice } from "@/hooks/use-reader-feed-slice";
import { useReaderFilterDraft } from "@/hooks/use-reader-filter-draft";
import { useReaderOverlayBridge } from "@/hooks/use-reader-overlay-bridge";
import { useReaderPreview } from "@/hooks/use-reader-preview";
import { useReaderRouteState } from "@/hooks/use-reader-route-state";
import { useReaderShortcutHandlers } from "@/hooks/use-reader-shortcut-handlers";
import { useReaderPreferences } from "@/lib/use-reader-preferences";

import { ReaderShellWorkspace } from "@/components/reader/reader-shell-workspace";
import { ReaderShortcutsSheet } from "@/components/reader/reader-shortcuts-sheet";

export type ReaderShellProps = {
  feeds: FeedSource[];
  stats: FeedStats;
  initialState: FeedsWorkspaceInitialState;
  initialBrowse: FeedsWorkspaceInitialBrowse;
};

export function ReaderShell({ feeds, stats, initialState, initialBrowse }: ReaderShellProps) {
  const router = useRouter();
  const { preferences, update } = useReaderPreferences();
  const { currentState, updateUrl, initialParamsString, searchParamsString } = useReaderRouteState({
    initialState,
    stats,
  });

  const { ready: localIndexReady, search: searchLocal } = useLocalSearchIndex();
  const queryInputRef = useRef<HTMLInputElement>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useSuspendReaderShortcuts("shortcuts-sheet", shortcutsOpen);

  const { candidateFeeds, feedLookup } = useReaderFeedSlice({ feeds, currentState });

  const {
    browse,
    loading,
    error,
    refreshing,
    refreshError,
    liveProgress,
    overlayArticles,
    refreshLatest,
    articleStateMap,
    visibleArticles,
    updateState,
    corpusEmpty,
  } = useReaderOverlayBridge({
    currentState,
    initialParamsString,
    searchParamsString,
    initialBrowse,
    candidateFeeds,
    feedLookup,
    localIndexReady,
    searchLocal,
  });

  const {
    previewArticleId,
    setPreviewArticleId,
    selectedArticle,
    selectedArticleState,
    clearPreview,
  } = useReaderPreview({ visibleArticles, articleStateMap });

  const { filterFormProps, mobileRail, resetDrafts } = useReaderFilterDraft({
    currentState,
    feeds,
    stats,
    updateUrl,
    layout: preferences.layout,
    onLayoutChange: (next) => update({ layout: next }),
    queryInputRef,
    onBeforeNavigate: clearPreview,
  });

  const presentationParams = {
    currentState,
    feedLookup,
    candidateFeedCount: candidateFeeds.length,
    stats,
    corpusEmpty,
    overlayCount: overlayArticles.length,
    totalMatched: browse.total_matched,
    corpusGeneratedAt: browse.corpus.generated_at,
    corpusLatestPublishedAt: browse.corpus.latest_published_at,
    visibleCount: visibleArticles.length,
  };
  const chrome = buildReaderWorkspaceChrome(presentationParams);
  const readerStats = buildReaderShellStats(presentationParams);
  const liveStatusText = buildLiveStatusText({
    liveProgress,
    visibleCount: visibleArticles.length,
  });

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
    onShowShortcuts: () => setShortcutsOpen(true),
    onCloseShortcuts: () => setShortcutsOpen(false),
  });

  return (
    <>
      <ReaderShellWorkspace
        corpusEmpty={corpusEmpty}
        overlayCount={overlayArticles.length}
        refreshing={refreshing}
        refreshError={refreshError}
        candidateFeedCount={candidateFeeds.length}
        onLoadLiveSample={() => void refreshLatest(true)}
        liveStatusText={liveStatusText}
        readerStats={readerStats}
        onRefreshLatest={() => void refreshLatest(true)}
        chrome={chrome}
        browse={browse}
        filterFormProps={filterFormProps}
        mobileRail={mobileRail}
        currentState={currentState}
        loading={loading}
        error={error}
        visibleArticles={visibleArticles}
        articleStateMap={articleStateMap}
        selectedArticle={selectedArticle}
        selectedArticleState={selectedArticleState}
        feedLookup={feedLookup}
        layout={preferences.layout}
        showSummaries={preferences.showSummaries}
        statsTotal={stats.total}
        statsTopicCount={stats.topicCount}
        onSelectArticle={handleSelectArticle}
        onUpdateState={updateState}
        onClosePreview={clearPreview}
        onFilterChip={updateUrl}
        onResetDrafts={resetDrafts}
        onPaginate={(cursor) => updateUrl({ cursor })}
        filtersDisabled={corpusEmpty && overlayArticles.length === 0}
      />
      <ReaderShortcutsSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}
