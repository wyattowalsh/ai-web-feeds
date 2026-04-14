"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Compass, Newspaper, RadioTower, Search as SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/search/search-bar";
import { SearchFilters } from "@/components/search/search-filters";
import { SearchResults } from "@/components/search/search-results";
import {
  ensureAnonymousUserId,
  fetchWithAnonymousIdentity,
  syncAnonymousUserIdFromResponse,
} from "@/lib/user-identity";
import {
  DEFAULT_SEARCH_THRESHOLD,
  DEFAULT_UNBOUNDED_SEARCH_META,
  normalizeSearchFilters,
  normalizeSearchQuery,
  parseSearchStateFromParams,
  toBackendSearchType,
  type SearchExecutionState,
  type SearchResponseMeta,
  type SearchResult,
  type SearchScope,
} from "@/lib/search";

export type InitialSearchRequestState = "idle" | "success" | "failed";

interface SearchPageClientProps {
  initialQuery: string;
  initialSearchState: SearchExecutionState;
  initialResults: SearchResult[];
  initialMeta: SearchResponseMeta;
  initialSearchRequestState: InitialSearchRequestState;
  shouldLogInitialSearch: boolean;
  basePath?: string;
  browseFeedsHref?: string;
  embedded?: boolean;
  forceScope?: SearchScope;
  readerBasePath?: string;
  readerMode?: "reader" | null;
  routeMode?: "catalog" | "articles" | "reader" | null;
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function areSearchStatesEqual(left: SearchExecutionState, right: SearchExecutionState): boolean {
  return (
    left.scope === right.scope &&
    left.source_type === right.source_type &&
    left.verified === right.verified &&
    areStringArraysEqual(left.feed_ids, right.feed_ids) &&
    areStringArraysEqual(left.topics, right.topics)
  );
}

function buildSearchParamsString(
  query: string,
  state: SearchExecutionState,
  options?: {
    includeScope?: boolean;
    routeMode?: "catalog" | "articles" | "reader" | null;
  },
): string {
  const params = new URLSearchParams();
  if (options?.routeMode) {
    params.set("mode", options.routeMode);
  }
  params.set("q", query);
  if (options?.includeScope !== false) {
    params.set("scope", state.scope);
  }

  if (state.source_type) {
    params.set("source_type", state.source_type);
  }
  if (state.topics.length > 0) {
    params.set("topics", state.topics.join(","));
  }
  if (state.verified !== undefined) {
    params.set("verified", String(state.verified));
  }
  for (const feedId of state.feed_ids) {
    params.append("feed", feedId);
  }

  return params.toString();
}

function withForcedScope(
  state: SearchExecutionState,
  forceScope?: SearchScope,
): SearchExecutionState {
  if (!forceScope) {
    return state;
  }

  return {
    ...state,
    scope: forceScope,
    searchType: forceScope,
    search_type: forceScope,
  };
}

export function SearchPageClient({
  initialQuery,
  initialSearchState,
  initialResults,
  initialMeta,
  initialSearchRequestState,
  shouldLogInitialSearch,
  basePath = "/search",
  browseFeedsHref = "/feeds",
  embedded = false,
  forceScope,
  readerBasePath = "/reader",
  readerMode = null,
  routeMode = null,
}: SearchPageClientProps) {
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const { push } = useRouter();

  const initialState = useMemo(
    () => withForcedScope(initialSearchState, forceScope),
    [forceScope, initialSearchState],
  );
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<SearchScope>(initialState.scope);
  const [feedIds, setFeedIds] = useState<string[]>(initialState.feed_ids);
  const [sourceType, setSourceType] = useState<string | undefined>(initialState.source_type);
  const [topics, setTopics] = useState<string[]>(initialState.topics);
  const [verified, setVerified] = useState<boolean | undefined>(initialState.verified);
  const [results, setResults] = useState<SearchResult[]>(initialResults);
  const [searchMeta, setSearchMeta] = useState<SearchResponseMeta>(initialMeta);
  const [loading, setLoading] = useState(
    initialSearchRequestState === "failed" && Boolean(initialQuery),
  );
  const [hasSearched, setHasSearched] = useState(Boolean(initialQuery));

  const searchStateRef = useRef<SearchExecutionState>(initialState);
  const hasInitializedRef = useRef(false);
  const hasLoggedInitialSearchRef = useRef(false);
  const searchRequestSequenceRef = useRef(0);
  const lastPushedSearchRef = useRef<string | null>(null);

  useEffect(() => {
    searchStateRef.current = {
      scope: forceScope ?? scope,
      searchType: forceScope ?? scope,
      search_type: forceScope ?? scope,
      feed_ids: feedIds,
      source_type: sourceType,
      topics,
      verified,
      threshold: initialState.threshold ?? DEFAULT_SEARCH_THRESHOLD,
    };
  }, [feedIds, forceScope, initialState.threshold, scope, sourceType, topics, verified]);

  const logSearchAnalytics = useCallback(
    async (searchQuery: string, state: SearchExecutionState, resultCount: number) => {
      const normalizedQuery = normalizeSearchQuery(searchQuery);
      if (!normalizedQuery) {
        return;
      }

      try {
        const authoritativeUserId = await ensureAnonymousUserId();
        const response = await fetchWithAnonymousIdentity("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: normalizedQuery,
            type: toBackendSearchType(state.scope),
            filters: normalizeSearchFilters({
              source_type: state.source_type,
              topics: state.topics,
              verified: state.verified,
            }),
            clicked_results: [],
            result_count: resultCount,
            user_id: authoritativeUserId,
          }),
        });

        syncAnonymousUserIdFromResponse(response);
      } catch (error) {
        console.error("Search analytics logging error:", error);
      }
    },
    [],
  );

  useEffect(() => {
    void ensureAnonymousUserId()
      .then(() => undefined)
      .catch((error) => {
        console.error("Anonymous identity bootstrap error:", error);
      });
  }, []);

  useEffect(() => {
    if (!shouldLogInitialSearch || !initialQuery || hasLoggedInitialSearchRef.current) {
      return;
    }

    hasLoggedInitialSearchRef.current = true;
    void logSearchAnalytics(initialQuery, initialState, initialResults.length);
  }, [
    initialQuery,
    initialResults.length,
    initialState,
    logSearchAnalytics,
    shouldLogInitialSearch,
  ]);

  const performSearch = useCallback(
    async (
      searchQuery: string,
      overrides: Partial<SearchExecutionState> = {},
      options?: { skipUrlSync?: boolean },
    ) => {
      const normalizedSearchQuery = normalizeSearchQuery(searchQuery);
      if (!normalizedSearchQuery) {
        return;
      }

      const currentSearchState = searchStateRef.current;
      const nextSearchState: SearchExecutionState = {
        scope: forceScope ?? overrides.scope ?? currentSearchState.scope,
        searchType: forceScope ?? overrides.scope ?? currentSearchState.scope,
        search_type: forceScope ?? overrides.scope ?? currentSearchState.scope,
        feed_ids: "feed_ids" in overrides ? overrides.feed_ids ?? [] : currentSearchState.feed_ids,
        source_type:
          "source_type" in overrides ? overrides.source_type : currentSearchState.source_type,
        topics: "topics" in overrides ? overrides.topics ?? [] : currentSearchState.topics,
        verified: "verified" in overrides ? overrides.verified : currentSearchState.verified,
        threshold: currentSearchState.threshold ?? DEFAULT_SEARCH_THRESHOLD,
      };
      const requestSequence = ++searchRequestSequenceRef.current;

      setLoading(true);
      setHasSearched(true);

      const paramsString = buildSearchParamsString(normalizedSearchQuery, nextSearchState);
      const canonicalParamsString = buildSearchParamsString(
        normalizedSearchQuery,
        nextSearchState,
        {
          includeScope: !forceScope,
          routeMode,
        },
      );
      if (!options?.skipUrlSync) {
        lastPushedSearchRef.current = canonicalParamsString;
        push(`${basePath}?${canonicalParamsString}`);
      }

      try {
        const response = await fetch(`/api/search?${paramsString}`);
        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data = (await response.json()) as {
          results?: SearchResult[];
          meta?: SearchResponseMeta;
        };
        if (requestSequence !== searchRequestSequenceRef.current) {
          return;
        }

        const nextResults = Array.isArray(data.results) ? data.results : [];
        setResults(nextResults);
        setSearchMeta(data.meta ?? DEFAULT_UNBOUNDED_SEARCH_META);
        void logSearchAnalytics(normalizedSearchQuery, nextSearchState, nextResults.length);
      } catch (error) {
        console.error("Search error:", error);
        if (requestSequence === searchRequestSequenceRef.current) {
          setResults([]);
          setSearchMeta(DEFAULT_UNBOUNDED_SEARCH_META);
        }
      } finally {
        if (requestSequence === searchRequestSequenceRef.current) {
          setLoading(false);
        }
      }
    },
    [basePath, forceScope, logSearchAnalytics, push, routeMode],
  );

  useEffect(() => {
    const paramsSnapshot = new URLSearchParams(searchParamsString);
    const queryFromUrl = normalizeSearchQuery(paramsSnapshot.get("q")) || "";
    const searchStateFromUrl = withForcedScope(
      parseSearchStateFromParams(paramsSnapshot),
      forceScope,
    );
    const normalizedParamsString = queryFromUrl
      ? buildSearchParamsString(queryFromUrl, searchStateFromUrl, {
          includeScope: !forceScope,
          routeMode,
        })
      : "";
    const matchesInitialSearch =
      queryFromUrl === initialQuery && areSearchStatesEqual(searchStateFromUrl, initialState);

    setQuery((current) => (current === queryFromUrl ? current : queryFromUrl));
    setScope((current) =>
      current === searchStateFromUrl.scope ? current : searchStateFromUrl.scope,
    );
    setFeedIds((current) =>
      areStringArraysEqual(current, searchStateFromUrl.feed_ids)
        ? current
        : searchStateFromUrl.feed_ids,
    );
    setSourceType((current) =>
      current === searchStateFromUrl.source_type ? current : searchStateFromUrl.source_type,
    );
    setTopics((current) =>
      areStringArraysEqual(current, searchStateFromUrl.topics)
        ? current
        : searchStateFromUrl.topics,
    );
    setVerified((current) =>
      current === searchStateFromUrl.verified ? current : searchStateFromUrl.verified,
    );

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;

      if (matchesInitialSearch) {
        if (
          queryFromUrl &&
          normalizedParamsString &&
          normalizedParamsString !== searchParamsString
        ) {
          lastPushedSearchRef.current = normalizedParamsString;
          push(`${basePath}?${normalizedParamsString}`);
        }

        if (initialSearchRequestState !== "failed") {
          return;
        }

        void performSearch(queryFromUrl, searchStateFromUrl, { skipUrlSync: true });
        return;
      }
    }

    if (!queryFromUrl) {
      setHasSearched(false);
      setLoading(false);
      setResults((current) => (current.length > 0 ? [] : current));
      setSearchMeta(DEFAULT_UNBOUNDED_SEARCH_META);
      return;
    }

    if (lastPushedSearchRef.current === searchParamsString) {
      return;
    }

    void performSearch(queryFromUrl, searchStateFromUrl, { skipUrlSync: true });
  }, [
    initialQuery,
    initialSearchRequestState,
    initialState,
    performSearch,
    forceScope,
    basePath,
    push,
    routeMode,
    searchParamsString,
  ]);

  const handleSearch = (nextQuery: string) => {
    const normalizedQuery = normalizeSearchQuery(nextQuery) ?? nextQuery.trim();
    setQuery(normalizedQuery);
    void performSearch(normalizedQuery);
  };

  const handleScopeChange = (nextScope: SearchScope) => {
    if (forceScope) {
      return;
    }

    setScope(nextScope);
    if (query) {
      void performSearch(query, { scope: nextScope });
    }
  };

  const handleSourceTypeChange = (nextSourceType: string | undefined) => {
    setSourceType(nextSourceType);
    if (query) {
      void performSearch(query, { source_type: nextSourceType });
    }
  };

  const handleTopicsChange = (nextTopics: string[]) => {
    setTopics(nextTopics);
    if (query) {
      void performSearch(query, { topics: nextTopics });
    }
  };

  const handleVerifiedChange = (nextVerified: boolean | undefined) => {
    setVerified(nextVerified);
    if (query) {
      void performSearch(query, { verified: nextVerified });
    }
  };

  const content = (
    <>
      <SearchBar onSearch={handleSearch} initialQuery={query} />

      <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <SearchFilters
            scope={scope}
            onScopeChange={handleScopeChange}
            showScopeToggle={!forceScope}
            sourceType={sourceType}
            onSourceTypeChange={handleSourceTypeChange}
            topics={topics}
            onTopicsChange={handleTopicsChange}
            verified={verified}
            onVerifiedChange={handleVerifiedChange}
          />
        </div>

        <div className="space-y-6">
          {hasSearched && query && (
            <div className="surface-card flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="metric-label">Current query</p>
                <p className="mt-2 text-base text-(--ink-muted)">
                  Showing {scope === "articles" ? "article" : "source"} results for{" "}
                  <span className="font-semibold text-(--ink)">{query}</span>
                </p>
                <p className="small-note mt-1">
                  {scope === "articles"
                    ? "Recent posts are pulled from the most relevant feeds in the local catalog."
                    : "Lexical matching is applied to source metadata in the shipped catalog."}
                </p>
                {scope === "articles" && searchMeta.bounded ? (
                  <p className="small-note mt-2">
                    Scanned {searchMeta.scanned_sources} of {searchMeta.candidate_sources} matching
                    sources, up to {searchMeta.per_source_limit} posts per source.
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {!hasSearched && (
            <div className="surface-card-soft">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
                  <SearchIcon className="size-5" />
                </span>
                <div>
                  <p className="metric-label">Search workflow</p>
                  <h2 className="text-2xl font-semibold text-(--ink)">
                    Start from a feed, topic, or keyword.
                  </h2>
                </div>
              </div>
              <p className="hero-copy max-w-2xl">
                {forceScope === "articles"
                  ? "Search recent posts from the current filtered source list without leaving the main workspace."
                  : "Search sources when you want the right publication. Search articles when you want matching recent posts from that part of the catalog."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={browseFeedsHref}
                  className="inline-flex items-center gap-2 rounded-2xl border border-(--line) px-4 py-2 text-sm font-medium text-(--ink) hover:bg-(--surface-muted)"
                >
                  Browse feeds first
                </Link>
                <Link
                  href={readerMode ? `${readerBasePath}?mode=${readerMode}` : readerBasePath}
                  className="inline-flex items-center gap-2 rounded-2xl border border-(--line) px-4 py-2 text-sm font-medium text-(--ink) hover:bg-(--surface-muted)"
                >
                  Open reader
                </Link>
              </div>
            </div>
          )}

          {hasSearched && (
            <SearchResults
              results={results}
              scope={scope}
              meta={searchMeta}
              loading={loading}
              readerBasePath={readerBasePath}
              readerMode={readerMode}
            />
          )}
        </div>
      </div>
    </>
  );

  if (embedded) {
    return <div className="space-y-8">{content}</div>;
  }

  return (
    <div className="page-wrap page-stack">
      <section className="surface-panel space-y-8">
        <div className="grid gap-8 md:gap-6 md:grid-cols-[1fr_0.9fr] lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-5">
            <span className="eyebrow">
              <Compass className="size-3.5" />
              Search
            </span>
            <div className="space-y-4">
              <h1 className="hero-title max-w-4xl">
                Find feeds or recent posts without leaving the app.
              </h1>
              <p className="hero-copy max-w-2xl">
                Use source search when you are choosing subscriptions. Switch to article search when
                you want to skim the freshest pulled posts from matching feeds.
              </p>
            </div>
          </div>

          <div className="surface-card-soft space-y-4">
            <p className="metric-label">Search modes</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-(--line) bg-(--surface) p-4">
                <div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
                  <RadioTower className="size-4" />
                </div>
                <h2 className="text-base font-semibold text-(--ink)">Sources</h2>
                <p className="small-note mt-1">
                  Search feed titles, descriptions, notes, and topic labels.
                </p>
              </div>
              <div className="rounded-3xl border border-(--line) bg-(--surface) p-4">
                <div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
                  <Newspaper className="size-4" />
                </div>
                <h2 className="text-base font-semibold text-(--ink)">Articles</h2>
                <p className="small-note mt-1">
                  Search recent pulled posts from the most relevant feeds.
                </p>
              </div>
            </div>
            <p className="small-note">
              Both modes are local-first, so the default experience stays fast and predictable.
            </p>
          </div>
        </div>
        {content}
      </section>
    </div>
  );
}
