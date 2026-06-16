"use client";

import { useMemo } from "react";

import { FeedCatalog } from "./feed-catalog";

import type { FeedSource } from "@/lib/feeds-filters";
import type {
  FeedsWorkspaceInitialBrowse,
  FeedsWorkspaceInitialState,
  FeedsWorkspaceMode,
} from "@/lib/reader-route-types";
import { DEFAULT_EMPTY_BROWSE, getSourceTypesFromFeeds, type FeedStats } from "@/lib/reader";
import { ReaderShell } from "@/components/reader/reader-shell";

type FeedsWorkspaceClientProps = {
  mode: FeedsWorkspaceMode;
  feeds: FeedSource[];
  stats: FeedStats;
  initialState: FeedsWorkspaceInitialState;
  initialBrowse: FeedsWorkspaceInitialBrowse | null;
};

export { ReaderShell } from "@/components/reader/reader-shell";

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
      initialBrowse={initialBrowse ?? DEFAULT_EMPTY_BROWSE}
    />
  );
}
