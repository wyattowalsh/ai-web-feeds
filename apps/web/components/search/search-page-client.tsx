"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Compass, Newspaper, RadioTower, Search as SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/search/search-bar";
import { SearchArtworkSlot, SEARCH_ARTWORKS } from "@/components/search/search-artwork";
import { SearchFilters } from "@/components/search/search-filters";
import { SearchResults } from "@/components/search/search-results";
import {
  ensureAnonymousUserId,
  fetchWithAnonymousIdentity,
  getStoredUserId,
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
    areStringArraysEqual(left.topics, right.topics)
  );
}

function buildSearchParamsString(query: string, state: SearchExecutionState): string {
  const params = new URLSearchParams();
  params.set("q", query);
  params.set("scope", state.scope);

  if (state.source_type) {
    params.set("source_type", state.source_type);
  }
  if (state.topics.length > 0) {
    params.set("topics", state.topics.join(","));
  }
  if (state.verified !== undefined) {
    params.set("verified", String(state.verified));
  }

  return params.toString();
}

export function SearchPageClient({
  initialQuery,
  initialSearchState,
  initialResults,
  initialMeta,
  initialSearchRequestState,
  shouldLogInitialSearch,
}: SearchPageClientProps) {
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const { push } = useRouter();

  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<SearchScope>(initialSearchState.scope);
  const [sourceType, setSourceType] = useState<string | undefined>(initialSearchState.source_type);
  const [topics, setTopics] = useState<string[]>(initialSearchState.topics);
  const [verified, setVerified] = useState<boolean | undefined>(initialSearchState.verified);
  const [results, setResults] = useState<SearchResult[]>(initialResults);
  const [searchMeta, setSearchMeta] = useState<SearchResponseMeta>(initialMeta);
  const [loading, setLoading] = useState(initialSearchRequestState === "failed" && Boolean(initialQuery));
  const [hasSearched, setHasSearched] = useState(Boolean(initialQuery));
  const [userId, setUserId] = useState<string>(() => getStoredUserId() ?? "");

  const searchStateRef = useRef<SearchExecutionState>(initialSearchState);
  const hasInitializedRef = useRef(false);
  const hasLoggedInitialSearchRef = useRef(false);
  const searchRequestSequenceRef = useRef(0);
  const lastPushedSearchRef = useRef<string | null>(null);

  useEffect(() => {
    searchStateRef.current = {
      scope,
      searchType: scope,
      search_type: scope,
      source_type: sourceType,
      topics,
      verified,
      threshold: initialSearchState.threshold ?? DEFAULT_SEARCH_THRESHOLD,
    };
  }, [initialSearchState.threshold, scope, sourceType, topics, verified]);

  const syncUserId = useCallback((nextUserId: string | null | undefined) => {
    if (!nextUserId || nextUserId === userId) {
      return;
    }

    setUserId(nextUserId);
  }, [userId]);

  const logSearchAnalytics = useCallback(
    async (searchQuery: string, state: SearchExecutionState, resultCount: number) => {
      const normalizedQuery = normalizeSearchQuery(searchQuery);
      if (!normalizedQuery) {
        return;
      }

      try {
        const authoritativeUserId = await ensureAnonymousUserId();
        syncUserId(authoritativeUserId);
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

        syncUserId(syncAnonymousUserIdFromResponse(response));
      } catch (error) {
        console.error("Search analytics logging error:", error);
      }
    },
    [syncUserId],
  );

  useEffect(() => {
    void ensureAnonymousUserId()
      .then(syncUserId)
      .catch((error) => {
        console.error("Anonymous identity bootstrap error:", error);
      });
  }, [syncUserId]);

  useEffect(() => {
    if (!shouldLogInitialSearch || !initialQuery || hasLoggedInitialSearchRef.current) {
      return;
    }

    hasLoggedInitialSearchRef.current = true;
    void logSearchAnalytics(initialQuery, initialSearchState, initialResults.length);
  }, [initialQuery, initialResults.length, initialSearchState, logSearchAnalytics, shouldLogInitialSearch]);

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
        scope: overrides.scope ?? currentSearchState.scope,
        searchType: overrides.scope ?? currentSearchState.scope,
        search_type: overrides.scope ?? currentSearchState.scope,
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
      if (!options?.skipUrlSync) {
        lastPushedSearchRef.current = paramsString;
        push(`/search?${paramsString}`);
      }

      try {
        const response = await fetch(`/api/search?${paramsString}`);
        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data = (await response.json()) as { results?: SearchResult[]; meta?: SearchResponseMeta };
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
    [logSearchAnalytics, push],
  );

  useEffect(() => {
    const paramsSnapshot = new URLSearchParams(searchParamsString);
    const queryFromUrl = normalizeSearchQuery(paramsSnapshot.get("q")) || "";
    const searchStateFromUrl = parseSearchStateFromParams(paramsSnapshot);
    const normalizedParamsString = queryFromUrl
      ? buildSearchParamsString(queryFromUrl, searchStateFromUrl)
      : "";
    const matchesInitialSearch =
      queryFromUrl === initialQuery && areSearchStatesEqual(searchStateFromUrl, initialSearchState);

    setQuery((current) => (current === queryFromUrl ? current : queryFromUrl));
    setScope((current) => (current === searchStateFromUrl.scope ? current : searchStateFromUrl.scope));
    setSourceType((current) =>
      current === searchStateFromUrl.source_type ? current : searchStateFromUrl.source_type,
    );
    setTopics((current) =>
      areStringArraysEqual(current, searchStateFromUrl.topics) ? current : searchStateFromUrl.topics,
    );
    setVerified((current) =>
      current === searchStateFromUrl.verified ? current : searchStateFromUrl.verified,
    );

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;

      if (matchesInitialSearch) {
        if (queryFromUrl && normalizedParamsString && normalizedParamsString !== searchParamsString) {
          lastPushedSearchRef.current = normalizedParamsString;
          push(`/search?${normalizedParamsString}`);
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
  }, [initialQuery, initialSearchRequestState, initialSearchState, performSearch, push, searchParamsString]);

  const handleSearch = (nextQuery: string) => {
    const normalizedQuery = normalizeSearchQuery(nextQuery) ?? nextQuery.trim();
    setQuery(normalizedQuery);
    void performSearch(normalizedQuery);
  };

  const handleScopeChange = (nextScope: SearchScope) => {
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

  return (
    <div className="page-wrap page-stack">
      <section className="surface-panel space-y-8">
        <div className="grid gap-8 md:gap-6 md:grid-cols-[1fr_0.9fr] lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-5">
            <span className="eyebrow">
              <Compass className="size-3.5" />
              Search and discovery
            </span>
            <div className="space-y-4">
              <h1 className="hero-title max-w-4xl">Search the AI source catalog or the latest pulled articles.</h1>
              <p className="hero-copy max-w-2xl">
                Default deployment is local-first: source search runs against the shipped catalog,
                and article search scans recent posts from the most relevant feeds without requiring
                an external backend.
              </p>
            </div>
          </div>

          <div className="surface-card-soft space-y-4">
            <p className="metric-label">Search scopes</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-(--line) bg-(--surface) p-4">
                <div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
                  <RadioTower className="size-4" />
                </div>
                <h2 className="text-base font-semibold text-(--ink)">Sources</h2>
                <p className="small-note mt-1">Search feed titles, descriptions, notes, and topics.</p>
              </div>
              <div className="rounded-3xl border border-(--line) bg-(--surface) p-4">
                <div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
                  <Newspaper className="size-4" />
                </div>
                <h2 className="text-base font-semibold text-(--ink)">Articles</h2>
                <p className="small-note mt-1">Search recent pulled posts from the most relevant feeds.</p>
              </div>
            </div>
            <SearchArtworkSlot
              {...SEARCH_ARTWORKS.modesComparison}
              priority
              sizes="(min-width: 1280px) 32rem, (min-width: 768px) 42vw, 100vw"
            />
          </div>
        </div>

        <SearchBar onSearch={handleSearch} initialQuery={query} />

        <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
          <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <SearchFilters
              scope={scope}
              onScopeChange={handleScopeChange}
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
                    <p className="metric-label">Start here</p>
                    <h2 className="text-2xl font-semibold text-(--ink)">Search the catalog without leaving the app.</h2>
                  </div>
                </div>
                <p className="hero-copy max-w-2xl">
                  Use source search when you want the right publication, and switch to article
                  search when you want matching recent posts from the most relevant feeds.
                </p>
                <SearchArtworkSlot
                  {...SEARCH_ARTWORKS.startHereOnboarding}
                  className="mt-6 max-w-3xl"
                  sizes="(min-width: 1280px) 48rem, (min-width: 768px) 70vw, 100vw"
                />
              </div>
            )}

            {hasSearched && (
              <SearchResults
                results={results}
                scope={scope}
                meta={searchMeta}
                loading={loading}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
