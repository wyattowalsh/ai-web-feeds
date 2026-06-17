"use client";

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";

import type { ReaderFiltersFormProps } from "@/components/reader/reader-filters-form";
import type { FeedSource } from "@/lib/feeds-filters";
import { getTopics } from "@/lib/feeds-filters";
import type { FeedsWorkspaceInitialState } from "@/lib/reader-route-types";
import {
  getSourceTypesFromFeeds,
  matchesDraftState,
  normalizeQueryDraft,
  normalizeTopicsValue,
  toVerifiedDraftValue,
  type FeedStats,
  type ReaderDraftState,
  type VerifiedDraftValue,
} from "@/lib/reader";

export type ReaderFilterFormProps = Omit<ReaderFiltersFormProps, "variant">;

export type ReaderFilterMobileRail = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export interface UseReaderFilterDraftParams {
  currentState: FeedsWorkspaceInitialState;
  feeds: FeedSource[];
  stats: FeedStats;
  updateUrl: (overrides: Record<string, string | string[] | null | undefined>) => void;
  layout: "cards" | "list" | "compact";
  onLayoutChange: (layout: "cards" | "list" | "compact") => void;
  queryInputRef: RefObject<HTMLInputElement | null>;
  onBeforeNavigate?: () => void;
}

export interface UseReaderFilterDraftResult {
  filterFormProps: ReaderFilterFormProps;
  mobileRail: ReaderFilterMobileRail;
  applyDrafts: () => void;
  resetDrafts: () => void;
}

/**
 * Hook extracted (wave 9 reader polish): unapplied filter drafts + apply/reset + form props.
 */
export function useReaderFilterDraft({
  currentState,
  feeds,
  stats,
  updateUrl,
  layout,
  onLayoutChange,
  queryInputRef,
  onBeforeNavigate,
}: UseReaderFilterDraftParams): UseReaderFilterDraftResult {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [queryDraft, setQueryDraft] = useState(currentState.query);
  const [sourceTypeDraft, setSourceTypeDraft] = useState(currentState.sourceType ?? "");
  const [topicsDraft, setTopicsDraft] = useState(currentState.topics);
  const [verifiedDraft, setVerifiedDraft] = useState<VerifiedDraftValue>(
    toVerifiedDraftValue(currentState.verified),
  );
  const [readerViewDraft, setReaderViewDraft] = useState(currentState.readerView);
  const [sortDraft, setSortDraft] = useState(currentState.sort);

  useEffect(() => {
    setQueryDraft(currentState.query);
    setSourceTypeDraft(currentState.sourceType ?? "");
    setTopicsDraft(currentState.topics);
    setVerifiedDraft(toVerifiedDraftValue(currentState.verified));
    setReaderViewDraft(currentState.readerView);
    setSortDraft(currentState.sort);
  }, [
    currentState.query,
    currentState.readerView,
    currentState.sort,
    currentState.sourceType,
    currentState.topics,
    currentState.verified,
  ]);

  const sourceTypes = useMemo(() => getSourceTypesFromFeeds(feeds), [feeds]);
  const topicOptions = useMemo(() => getTopics(feeds), [feeds]);
  const topicCounts = useMemo(
    () =>
      topicOptions
        .map((topic) => ({
          topic,
          count: feeds.filter((feed) =>
            new Set([...(feed.topics ?? []), ...(feed.tags ?? [])]).has(topic),
          ).length,
        }))
        .sort((left, right) => right.count - left.count || left.topic.localeCompare(right.topic))
        .slice(0, 12),
    [feeds, topicOptions],
  );
  const availableTopicOptions = useMemo(
    () => topicOptions.filter((topic) => !topicsDraft.includes(topic)),
    [topicOptions, topicsDraft],
  );

  const draftState: ReaderDraftState = useMemo(
    () => ({
      query: queryDraft,
      sourceType: sourceTypeDraft,
      topics: topicsDraft,
      verified: verifiedDraft,
      readerView: readerViewDraft,
      sort: sortDraft,
    }),
    [queryDraft, readerViewDraft, sortDraft, sourceTypeDraft, topicsDraft, verifiedDraft],
  );
  const hasPendingDraftChanges = !matchesDraftState(draftState, currentState);

  const applyDrafts = useCallback(() => {
    onBeforeNavigate?.();
    updateUrl({
      q: normalizeQueryDraft(queryDraft) || null,
      source_type: sourceTypeDraft || null,
      topics: topicsDraft.length > 0 ? normalizeTopicsValue(topicsDraft) : null,
      verified: verifiedDraft || null,
      reader_view: readerViewDraft === "latest" ? null : readerViewDraft,
      sort: sortDraft === "latest" ? null : sortDraft,
      cursor: null,
    });
    setMobileOpen(false);
  }, [
    onBeforeNavigate,
    queryDraft,
    readerViewDraft,
    sortDraft,
    sourceTypeDraft,
    topicsDraft,
    updateUrl,
    verifiedDraft,
  ]);

  const resetDrafts = useCallback(() => {
    onBeforeNavigate?.();
    setQueryDraft("");
    setSourceTypeDraft("");
    setTopicsDraft([]);
    setVerifiedDraft("");
    setReaderViewDraft("latest");
    setSortDraft("latest");
    updateUrl({
      q: null,
      source_type: null,
      topics: null,
      verified: null,
      reader_view: null,
      sort: null,
      cursor: null,
      feed: null,
    });
    setMobileOpen(false);
  }, [onBeforeNavigate, updateUrl]);

  const filterFormProps = useMemo<ReaderFilterFormProps>(
    () => ({
      draftState,
      setQuery: setQueryDraft,
      setSourceType: setSourceTypeDraft,
      setTopics: setTopicsDraft,
      setVerified: setVerifiedDraft,
      setReaderView: setReaderViewDraft,
      setSort: setSortDraft,
      applyDrafts,
      resetDrafts,
      topicCounts,
      hasVerificationMetadata: stats.hasVerificationMetadata,
      layout,
      onLayoutChange,
      sourceTypes,
      availableTopicOptions,
      queryInputRef,
      hasPendingDraftChanges,
    }),
    [
      applyDrafts,
      availableTopicOptions,
      draftState,
      hasPendingDraftChanges,
      layout,
      onLayoutChange,
      queryInputRef,
      resetDrafts,
      sourceTypes,
      stats.hasVerificationMetadata,
      topicCounts,
    ],
  );

  const mobileRail = useMemo<ReaderFilterMobileRail>(
    () => ({
      open: mobileOpen,
      onOpenChange: setMobileOpen,
    }),
    [mobileOpen],
  );

  return { filterFormProps, mobileRail, applyDrafts, resetDrafts };
}
