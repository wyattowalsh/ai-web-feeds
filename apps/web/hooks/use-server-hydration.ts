"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { SavedReaderFilter } from "@/hooks/use-saved-reader-filters";
import { preferences } from "@/lib/db";
import type { Preferences } from "@/lib/db";
import { saveArticleStatesToIDB } from "@/lib/reader/hydrate-article-state";
import type { ReaderArticleState } from "@/lib/reader/types";
import { trackEvent } from "@/lib/track-event";

export type ServerFollowRecord = {
  id?: number;
  user_id?: string;
  source_id: string;
  followed_at: string;
};

export type ServerSavedSearchRecord = {
  id: string;
  user_id: string;
  search_name: string;
  query_text: string;
  filters: Record<string, unknown>;
  created_at: string;
  last_used_at: string;
  use_count?: number;
  pinned?: boolean;
  is_default?: boolean;
};

export type ServerArticleStateRecord = {
  article_key: string;
  read: boolean;
  starred: boolean;
  archived: boolean;
  bookmarked: boolean;
  read_duration_ms?: number | null;
  scroll_depth?: number | null;
  opened_from?: string | null;
  updated_at?: string;
};

export type HydrationSummary = {
  filters: number;
  follows: number;
  savedSearches: number;
  articleStates: number;
  errors: string[];
};

type ServerUserCachePrefs = Preferences & {
  serverReaderFilters?: SavedReaderFilter[];
  serverFollows?: ServerFollowRecord[];
  serverSavedSearches?: ServerSavedSearchRecord[];
  serverHydratedAt?: number;
  serverHydratedForUserId?: string;
};

function toReaderArticleState(record: ServerArticleStateRecord): ReaderArticleState {
  return {
    read: Boolean(record.read),
    starred: Boolean(record.starred),
    archived: Boolean(record.archived),
    bookmarked: Boolean(record.bookmarked),
  };
}

export async function persistServerUserCache(params: {
  sessionUserId: string;
  filters: SavedReaderFilter[];
  follows: ServerFollowRecord[];
  savedSearches: ServerSavedSearchRecord[];
  articleStates: ServerArticleStateRecord[];
}): Promise<void> {
  const articleStateMap: Record<string, ReaderArticleState> = {};
  for (const state of params.articleStates) {
    const articleKey = state.article_key?.trim();
    if (!articleKey) {
      continue;
    }

    articleStateMap[articleKey] = toReaderArticleState(state);
  }

  if (Object.keys(articleStateMap).length > 0) {
    await saveArticleStatesToIDB(articleStateMap);
  }

  const current = (await preferences.get()) as ServerUserCachePrefs;
  const next: ServerUserCachePrefs = {
    ...current,
    id: "user_prefs",
    serverReaderFilters: params.filters,
    serverFollows: params.follows,
    serverSavedSearches: params.savedSearches,
    serverHydratedAt: Date.now(),
    serverHydratedForUserId: params.sessionUserId,
    updatedAt: Date.now(),
  };

  await preferences.put(next);
}

async function fetchJson<T>(
  url: string,
  fetchImpl: typeof fetch,
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    const data = (await response.json().catch(() => null)) as T | null;

    if (!response.ok) {
      const errorBody = data as { error?: string } | null;
      return {
        ok: false,
        status: response.status,
        data: null,
        error: errorBody?.error ?? `Request failed (${response.status})`,
      };
    }

    return { ok: true, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}

export async function hydrateFromServer(params: {
  sessionUserId: string;
  fetchImpl?: typeof fetch;
}): Promise<HydrationSummary> {
  const { sessionUserId, fetchImpl = fetch } = params;
  const summary: HydrationSummary = {
    filters: 0,
    follows: 0,
    savedSearches: 0,
    articleStates: 0,
    errors: [],
  };

  if (!sessionUserId?.trim()) {
    summary.errors.push("Missing session user id");
    return summary;
  }

  const encodedUserId = encodeURIComponent(sessionUserId);

  const [filtersResult, followsResult, savedSearchesResult, stateResult] = await Promise.all([
    fetchJson<{ filters?: SavedReaderFilter[] }>(
      `/api/user/filters?user_id=${encodedUserId}`,
      fetchImpl,
    ),
    fetchJson<{ follows?: ServerFollowRecord[] }>(
      `/api/follows?user_id=${encodedUserId}`,
      fetchImpl,
    ),
    fetchJson<ServerSavedSearchRecord[] | { error?: string }>(
      `/api/search/saved?user_id=${encodedUserId}`,
      fetchImpl,
    ),
    fetchJson<{ states?: ServerArticleStateRecord[] }>(
      `/api/user/state?user_id=${encodedUserId}`,
      fetchImpl,
    ),
  ]);

  const filters = filtersResult.ok ? filtersResult.data?.filters ?? [] : [];
  const follows = followsResult.ok ? followsResult.data?.follows ?? [] : [];
  const savedSearches = savedSearchesResult.ok
    ? Array.isArray(savedSearchesResult.data)
      ? savedSearchesResult.data
      : []
    : [];
  const articleStates = stateResult.ok ? stateResult.data?.states ?? [] : [];

  for (const result of [filtersResult, followsResult, savedSearchesResult, stateResult]) {
    if (!result.ok && result.status !== 503) {
      summary.errors.push(result.error ?? "Hydration request failed");
    }
  }

  summary.filters = filters.length;
  summary.follows = follows.length;
  summary.savedSearches = savedSearches.length;
  summary.articleStates = articleStates.length;

  const hasAnyData =
    filters.length > 0 ||
    follows.length > 0 ||
    savedSearches.length > 0 ||
    articleStates.length > 0;

  if (hasAnyData) {
    try {
      await persistServerUserCache({
        sessionUserId,
        filters,
        follows,
        savedSearches,
        articleStates,
      });
    } catch (error) {
      summary.errors.push(
        error instanceof Error ? error.message : "Failed to persist hydrated server data",
      );
    }
  }

  void trackEvent("sync.hydration.complete", {
    surface: "sync",
    userId: sessionUserId,
    properties: {
      filters: summary.filters,
      follows: summary.follows,
      savedSearches: summary.savedSearches,
      articleStates: summary.articleStates,
      errorCount: summary.errors.length,
    },
  });

  return summary;
}

export type UseServerHydrationOptions = {
  sessionUserId?: string | null;
  enabled?: boolean;
  autoRun?: boolean;
};

export type UseServerHydrationResult = {
  hydrating: boolean;
  lastSummary: HydrationSummary | null;
  error: string | null;
  hydrate: (sessionUserId?: string) => Promise<HydrationSummary>;
};

export function useServerHydration(
  options: UseServerHydrationOptions = {},
): UseServerHydrationResult {
  const { sessionUserId, enabled = true, autoRun = false } = options;
  const [hydrating, setHydrating] = useState(false);
  const [lastSummary, setLastSummary] = useState<HydrationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ranForUserRef = useRef<string | null>(null);

  const hydrate = useCallback(
    async (overrideSessionUserId?: string): Promise<HydrationSummary> => {
      const resolvedUserId = overrideSessionUserId ?? sessionUserId?.trim();
      if (!resolvedUserId) {
        const empty: HydrationSummary = {
          filters: 0,
          follows: 0,
          savedSearches: 0,
          articleStates: 0,
          errors: ["Missing session user id"],
        };
        setLastSummary(empty);
        setError(empty.errors[0] ?? null);
        return empty;
      }

      setHydrating(true);
      setError(null);

      const summary = await hydrateFromServer({ sessionUserId: resolvedUserId });
      setLastSummary(summary);
      setHydrating(false);

      if (summary.errors.length > 0) {
        setError(summary.errors.join("; "));
      }

      return summary;
    },
    [sessionUserId],
  );

  useEffect(() => {
    if (!enabled || !autoRun) {
      return;
    }

    const resolvedUserId = sessionUserId?.trim();
    if (!resolvedUserId) {
      ranForUserRef.current = null;
      return;
    }

    if (ranForUserRef.current === resolvedUserId) {
      return;
    }

    ranForUserRef.current = resolvedUserId;
    void hydrate(resolvedUserId);
  }, [autoRun, enabled, hydrate, sessionUserId]);

  return {
    hydrating,
    lastSummary,
    error,
    hydrate,
  };
}
