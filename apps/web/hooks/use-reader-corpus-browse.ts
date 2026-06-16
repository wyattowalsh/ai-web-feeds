"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import type {
  FeedsWorkspaceInitialBrowse,
  FeedsWorkspaceInitialState,
} from "@/lib/reader-route-types";
import { DEFAULT_PAGE_LIMIT, normalizeTopicsValue } from "@/lib/reader";

export interface UseReaderCorpusBrowseParams {
  currentState: FeedsWorkspaceInitialState;
  initialParamsString: string;
  searchParamsString: string;
  initialBrowse: FeedsWorkspaceInitialBrowse;
  onBrowseStart?: () => void;
}

export interface UseReaderCorpusBrowseResult {
  browse: FeedsWorkspaceInitialBrowse;
  loading: boolean;
  error: string | null;
  setBrowse: Dispatch<SetStateAction<FeedsWorkspaceInitialBrowse>>;
}

export function useReaderCorpusBrowse({
  currentState,
  initialParamsString,
  searchParamsString,
  initialBrowse,
  onBrowseStart,
}: UseReaderCorpusBrowseParams): UseReaderCorpusBrowseResult {
  const [browse, setBrowse] = useState<FeedsWorkspaceInitialBrowse>(initialBrowse);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstLoadRef = useRef(true);
  const onBrowseStartRef = useRef(onBrowseStart);
  onBrowseStartRef.current = onBrowseStart;

  useEffect(() => {
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      const initialQuery = initialParamsString.split("?")[1] ?? "";
      if (searchParamsString === initialQuery) {
        return;
      }
    }

    const controller = new AbortController();
    const params = new URLSearchParams();
    if (currentState.query) {
      params.set("q", currentState.query);
    }
    if (currentState.sourceType) {
      params.set("source_type", currentState.sourceType);
    }
    if (currentState.topics.length > 0) {
      params.set("topics", normalizeTopicsValue(currentState.topics));
    }
    if (typeof currentState.verified === "boolean") {
      params.set("verified", String(currentState.verified));
    }
    if (currentState.sort !== "latest") {
      params.set("sort", currentState.sort);
    }
    if (currentState.cursor > 0) {
      params.set("cursor", String(currentState.cursor));
    }
    if (currentState.limit !== DEFAULT_PAGE_LIMIT) {
      params.set("limit", String(currentState.limit));
    }
    for (const feedId of currentState.feedIds) {
      params.append("feed", feedId);
    }

    onBrowseStartRef.current?.();

    setLoading(true);
    setError(null);

    void fetch(`/api/articles?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Failed to load articles");
        }

        return (await response.json()) as FeedsWorkspaceInitialBrowse;
      })
      .then((payload) => {
        setBrowse(payload);
      })
      .catch((nextError) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(nextError instanceof Error ? nextError.message : "Failed to load articles");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [currentState, initialParamsString, searchParamsString]);

  return { browse, loading, error, setBrowse };
}
