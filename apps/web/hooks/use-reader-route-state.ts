"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { buildReaderHref } from "@/lib/reader";
import { parseInitialState } from "@/lib/reader-route-parse";
import type { FeedsWorkspaceInitialState } from "@/lib/reader-route-types";
import type { FeedStats } from "@/lib/reader";

export interface UseReaderRouteStateParams {
  initialState: FeedsWorkspaceInitialState;
  stats: FeedStats;
}

export interface UseReaderRouteStateResult {
  currentState: FeedsWorkspaceInitialState;
  updateUrl: (overrides: Record<string, string | string[] | null | undefined>) => void;
  initialParamsString: string;
  searchParamsString: string;
}

/**
 * Hook extracted (wave 9 reader polish): URL-derived reader state + replace navigation.
 */
export function useReaderRouteState({
  initialState,
  stats,
}: UseReaderRouteStateParams): UseReaderRouteStateResult {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  const initialParamsString = useMemo(
    () =>
      buildReaderHref(
        {
          query: initialState.query,
          sourceType: initialState.sourceType,
          topics: initialState.topics,
          verified: initialState.verified,
          feedIds: initialState.feedIds,
          sort: initialState.sort,
          readerView: initialState.readerView,
          cursor: initialState.cursor,
        },
        {},
      ),
    [initialState],
  );

  const currentState = useMemo<FeedsWorkspaceInitialState>(() => {
    const parsed = parseInitialState(searchParams);
    return {
      ...parsed,
      verified: stats.hasVerificationMetadata ? parsed.verified : null,
    };
  }, [searchParams, stats.hasVerificationMetadata]);

  const updateUrl = useCallback(
    (overrides: Record<string, string | string[] | null | undefined>) => {
      const nextHref = buildReaderHref(currentState, overrides);
      router.replace(nextHref, { scroll: false });
    },
    [currentState, router],
  );

  return { currentState, updateUrl, initialParamsString, searchParamsString };
}
