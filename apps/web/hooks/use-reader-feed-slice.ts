"use client";

import { useMemo } from "react";

import type { FeedSource } from "@/lib/feeds-filters";
import type { FeedsWorkspaceInitialState } from "@/lib/reader-route-types";
import { buildFeedLookup } from "@/lib/reader/build-feed-lookup";
import { filterCandidateFeeds } from "@/lib/reader/filter-candidate-feeds";

export interface UseReaderFeedSliceParams {
  feeds: FeedSource[];
  currentState: Pick<FeedsWorkspaceInitialState, "feedIds" | "sourceType" | "topics" | "verified">;
}

export interface UseReaderFeedSliceResult {
  candidateFeeds: FeedSource[];
  feedLookup: Map<string, FeedSource>;
}

export function useReaderFeedSlice({
  feeds,
  currentState,
}: UseReaderFeedSliceParams): UseReaderFeedSliceResult {
  const candidateFeeds = useMemo(
    () =>
      filterCandidateFeeds(feeds, {
        feedIds: currentState.feedIds,
        sourceType: currentState.sourceType,
        topics: currentState.topics,
        verified: currentState.verified,
      }),
    [
      currentState.feedIds,
      currentState.sourceType,
      currentState.topics,
      currentState.verified,
      feeds,
    ],
  );

  const feedLookup = useMemo(() => buildFeedLookup(feeds), [feeds]);

  return { candidateFeeds, feedLookup };
}
