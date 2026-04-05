"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Compass, Save, Search as SearchIcon, Sparkles, X } from "lucide-react";
import { SearchBar } from "@/components/search/search-bar";
import { SearchArtworkSlot, SEARCH_ARTWORKS } from "@/components/search/search-artwork";
import { SearchFilters } from "@/components/search/search-filters";
import { SearchResults } from "@/components/search/search-results";
import { SavedSearches } from "@/components/search/saved-searches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ensureAnonymousUserId,
  fetchWithAnonymousIdentity,
  getStoredUserId,
  syncAnonymousUserIdFromResponse,
} from "@/lib/user-identity";
import {
  DEFAULT_SEARCH_THRESHOLD,
  normalizeSearchFilters,
  normalizeSearchQuery,
  parseSearchStateFromParams,
  type SearchExecutionState,
  type SearchType,
} from "@/lib/search";

export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  url: string;
  topics: string[];
  source_type: string;
  verified: boolean;
  is_active: boolean;
  similarity?: number;
}

interface SavedSearchFilters {
  search_type?: SearchType;
  source_type?: string;
  topics?: string[];
  verified?: boolean;
  threshold?: number;
}

export type InitialSearchRequestState = "idle" | "success" | "failed";

interface SearchPageClientProps {
  initialQuery: string;
  initialSearchState: SearchExecutionState;
  initialResults: SearchResult[];
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
    left.searchType === right.searchType &&
    left.source_type === right.source_type &&
    left.verified === right.verified &&
    left.threshold === right.threshold &&
    areStringArraysEqual(left.topics, right.topics)
  );
}

function buildSearchParamsString(query: string, state: SearchExecutionState): string {
  const params = new URLSearchParams();
  params.set("q", query);
  params.set("type", state.searchType);

  if (state.source_type) {
    params.set("source_type", state.source_type);
  }
  if (state.topics.length > 0) {
    params.set("topics", state.topics.join(","));
  }
  if (state.verified !== undefined) {
    params.set("verified", String(state.verified));
  }
  if (state.searchType === "semantic") {
    params.set("threshold", String(state.threshold));
  }

  return params.toString();
}

async function getResponseErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);

    if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
      const errorMessage = payload.error.trim();
      if (errorMessage) {
        return errorMessage;
      }
    }
  }

  const errorText = await response.text().catch(() => "");

  return errorText.trim() || fallback;
}

export function SearchPageClient({
  initialQuery,
  initialSearchState,
  initialResults,
  initialSearchRequestState,
  shouldLogInitialSearch,
}: SearchPageClientProps) {
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const { push } = useRouter();

  const [query, setQuery] = useState(initialQuery);
  const [searchType, setSearchType] = useState<SearchType>(initialSearchState.searchType);
  const [sourceType, setSourceType] = useState<string | undefined>(initialSearchState.source_type);
  const [topics, setTopics] = useState<string[]>(initialSearchState.topics);
  const [verified, setVerified] = useState<boolean | undefined>(initialSearchState.verified);
  const [threshold, setThreshold] = useState(initialSearchState.threshold);
  const [results, setResults] = useState<SearchResult[]>(initialResults);
  const [loading, setLoading] = useState(initialSearchRequestState === "failed" && Boolean(initialQuery));
  const [hasSearched, setHasSearched] = useState(Boolean(initialQuery));
  const [saveMode, setSaveMode] = useState<"idle" | "naming" | "saving" | "saved" | "error">("idle");
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>(() => getStoredUserId() ?? "");

  const searchStateRef = useRef<SearchExecutionState>(initialSearchState);
  const userIdRef = useRef(userId);
  const hasInitializedRef = useRef(false);
  const hasLoggedInitialSearchRef = useRef(false);
  const searchRequestSequenceRef = useRef(0);
  const lastPushedSearchRef = useRef<string | null>(null);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    searchStateRef.current = {
      searchType,
      search_type: searchType,
      source_type: sourceType,
      topics,
      verified,
      threshold,
    };
  }, [searchType, sourceType, threshold, topics, verified]);

  const syncUserId = useCallback((nextUserId: string | null | undefined) => {
    if (!nextUserId || nextUserId === userIdRef.current) {
      return;
    }

    userIdRef.current = nextUserId;
    setUserId(nextUserId);
  }, []);

  const ensureAuthoritativeSearchUserId = useCallback(async () => {
    // Every search-scoped write must await the same bootstrap promise so the
    // first persisted event cannot diverge from the server-issued binding.
    const resolvedUserId = await ensureAnonymousUserId();
    syncUserId(resolvedUserId);
    return resolvedUserId;
  }, [syncUserId]);

  const logSearchAnalytics = useCallback(
    async ({
      searchQuery,
      state,
      clickedResults,
      resultCount,
      requestUserId,
    }: {
      searchQuery: string;
      state: SearchExecutionState;
      clickedResults: string[];
      resultCount: number;
      requestUserId?: string;
    }) => {
      const normalizedSearchQuery = normalizeSearchQuery(searchQuery);
      if (!normalizedSearchQuery) {
        return;
      }

      try {
        const authoritativeUserId = await ensureAuthoritativeSearchUserId();
        const effectiveRequestUserId = requestUserId ?? authoritativeUserId;
        const response = await fetchWithAnonymousIdentity("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: normalizedSearchQuery,
            type: state.searchType,
            filters: normalizeSearchFilters({
              search_type: state.searchType,
              source_type: state.source_type,
              topics: state.topics,
              verified: state.verified,
              threshold: state.threshold,
            }),
            clicked_results: clickedResults,
            result_count: resultCount,
            ...(effectiveRequestUserId ? { user_id: effectiveRequestUserId } : {}),
          }),
        });

        syncUserId(syncAnonymousUserIdFromResponse(response));
      } catch (error) {
        console.error("Search analytics logging error:", error);
      }
    },
    [ensureAuthoritativeSearchUserId, syncUserId],
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
    void logSearchAnalytics({
      searchQuery: initialQuery,
      state: initialSearchState,
      clickedResults: [],
      resultCount: initialResults.length,
    });
  }, [initialQuery, initialResults.length, initialSearchState, logSearchAnalytics, shouldLogInitialSearch]);

  const performSearch = useCallback(
    async (
      searchQuery: string,
      overrides: Partial<SearchExecutionState> = {},
      requestUserId?: string,
      options?: { skipUrlSync?: boolean },
    ) => {
      const normalizedSearchQuery = normalizeSearchQuery(searchQuery);
      if (!normalizedSearchQuery) {
        return;
      }

      const currentSearchState = searchStateRef.current;
      const effectiveSearchType = overrides.searchType ?? currentSearchState.searchType;
      const normalizedFilters = normalizeSearchFilters({
        search_type: effectiveSearchType,
        source_type: "source_type" in overrides ? overrides.source_type : currentSearchState.source_type,
        topics: "topics" in overrides ? (overrides.topics ?? []) : currentSearchState.topics,
        verified: "verified" in overrides ? overrides.verified : currentSearchState.verified,
        threshold: typeof overrides.threshold === "number" ? overrides.threshold : currentSearchState.threshold,
      });
      const nextSearchState: SearchExecutionState = {
        searchType: effectiveSearchType,
        search_type: effectiveSearchType,
        source_type: normalizedFilters.source_type,
        topics: normalizedFilters.topics ?? [],
        verified: normalizedFilters.verified,
        threshold: normalizedFilters.threshold ?? DEFAULT_SEARCH_THRESHOLD,
      };
      const activeUserId = requestUserId ?? (userIdRef.current || undefined);
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

        const data = (await response.json()) as { results?: SearchResult[] };
        if (requestSequence !== searchRequestSequenceRef.current) {
          return;
        }

        const nextResults = Array.isArray(data.results) ? data.results : [];
        setResults(nextResults);
        void logSearchAnalytics({
          searchQuery: normalizedSearchQuery,
          state: nextSearchState,
          clickedResults: [],
          resultCount: nextResults.length,
          requestUserId: activeUserId,
        });
      } catch (error) {
        console.error("Search error:", error);
        if (requestSequence === searchRequestSequenceRef.current) {
          setResults([]);
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
    setSearchType((current) => (current === searchStateFromUrl.searchType ? current : searchStateFromUrl.searchType));
    setSourceType((current) => (current === searchStateFromUrl.source_type ? current : searchStateFromUrl.source_type));
    setTopics((current) => (areStringArraysEqual(current, searchStateFromUrl.topics) ? current : searchStateFromUrl.topics));
    setVerified((current) => (current === searchStateFromUrl.verified ? current : searchStateFromUrl.verified));
    setThreshold((current) => (current === searchStateFromUrl.threshold ? current : searchStateFromUrl.threshold));

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

        void performSearch(queryFromUrl, searchStateFromUrl, undefined, { skipUrlSync: true });
        return;
      }
    }

    if (!queryFromUrl) {
      setHasSearched(false);
      setLoading(false);
      setResults((current) => (current.length > 0 ? [] : current));
      return;
    }

    if (lastPushedSearchRef.current === searchParamsString) {
      return;
    }

    void performSearch(queryFromUrl, searchStateFromUrl, undefined, { skipUrlSync: true });
  }, [initialQuery, initialSearchRequestState, initialSearchState, performSearch, push, searchParamsString]);

  const handleSearch = (nextQuery: string) => {
    const normalizedQuery = normalizeSearchQuery(nextQuery) ?? nextQuery.trim();
    setQuery(normalizedQuery);
    void performSearch(normalizedQuery);
  };

  const handleLoadSavedSearch = (savedQuery: string, savedFilters: SavedSearchFilters) => {
    const normalizedSavedFilters = normalizeSearchFilters(savedFilters);
    const nextSearchType = normalizedSavedFilters.search_type ?? searchType;
    const nextSearchState: Partial<SearchExecutionState> = {
      searchType: nextSearchType,
      source_type: normalizedSavedFilters.source_type,
      topics: normalizedSavedFilters.topics ?? [],
      verified: normalizedSavedFilters.verified,
      threshold:
        typeof normalizedSavedFilters.threshold === "number"
          ? normalizedSavedFilters.threshold
          : DEFAULT_SEARCH_THRESHOLD,
    };
    const normalizedSavedQuery = normalizeSearchQuery(savedQuery) ?? "";

    setQuery(normalizedSavedQuery);
    setSearchType(nextSearchType);
    setSourceType(nextSearchState.source_type);
    setTopics(nextSearchState.topics ?? []);
    setVerified(nextSearchState.verified);
    setThreshold(nextSearchState.threshold ?? DEFAULT_SEARCH_THRESHOLD);
    void performSearch(normalizedSavedQuery, nextSearchState);
  };

  const handleResultClick = async (feedId: string) => {
    await logSearchAnalytics({
      searchQuery: normalizeSearchQuery(query) ?? query,
      state: searchStateRef.current,
      clickedResults: [feedId],
      resultCount: results.length,
      requestUserId: userIdRef.current || undefined,
    });
  };

  const handleSaveSearch = () => {
    setSaveName("");
    setSaveError(null);
    setSaveMode("naming");
  };

  const handleConfirmSave = useCallback(async () => {
    if (!saveName.trim()) {
      return;
    }

    setSaveMode("saving");
    setSaveError(null);

    try {
      const activeUserId = await ensureAuthoritativeSearchUserId();
      const response = await fetchWithAnonymousIdentity("/api/search/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search_name: saveName.trim(),
          query_text: normalizeSearchQuery(query) ?? query,
          filters: normalizeSearchFilters({
            search_type: searchType,
            source_type: sourceType,
            topics,
            verified,
            threshold,
          }),
          ...(activeUserId ? { user_id: activeUserId } : {}),
        }),
      });
      syncUserId(syncAnonymousUserIdFromResponse(response));

      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response, "Failed to save search. Please try again."));
      }

      setSaveMode("saved");
      setSaveName("");
      setTimeout(() => setSaveMode("idle"), 3000);
    } catch (error) {
      console.error("Failed to save search:", error);
      setSaveError(error instanceof Error ? error.message : "Failed to save search. Please try again.");
      setSaveMode("error");
    }
  }, [ensureAuthoritativeSearchUserId, query, saveName, searchType, sourceType, threshold, topics, verified, syncUserId]);

  const handleCancelSave = () => {
    setSaveMode("idle");
    setSaveName("");
    setSaveError(null);
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
              <h1 className="hero-title max-w-4xl">Find the right feeds without scanning the catalog manually.</h1>
              <p className="hero-copy max-w-2xl">
                Move from exact keyword lookup to semantic discovery, then save the searches worth
                repeating. This surface is optimized for fast narrowing and deliberate comparison.
              </p>
            </div>
          </div>

          <div className="surface-card-soft space-y-4">
            <p className="metric-label">Search modes</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-(--line) bg-(--surface) p-4">
                <div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
                  <SearchIcon className="size-4" />
                </div>
                <h2 className="text-base font-semibold text-(--ink)">Full-text</h2>
                <p className="small-note mt-1">Best for exact titles, topics, and known phrases.</p>
              </div>
              <div className="rounded-3xl border border-(--line) bg-(--surface) p-4">
                <div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
                  <Sparkles className="size-4" />
                </div>
                <h2 className="text-base font-semibold text-(--ink)">Semantic</h2>
                <p className="small-note mt-1">Best for adjacent concepts and similarity-based exploration.</p>
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
              searchType={searchType}
              onSearchTypeChange={setSearchType}
              sourceType={sourceType}
              onSourceTypeChange={setSourceType}
              topics={topics}
              onTopicsChange={setTopics}
              verified={verified}
              onVerifiedChange={setVerified}
              threshold={threshold}
              onThresholdChange={setThreshold}
            />

            {userId && <SavedSearches userId={userId} onLoadSearch={handleLoadSavedSearch} />}
          </div>

          <div className="space-y-6">
            {hasSearched && query && (
              <div className="surface-card flex flex-col gap-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="metric-label">Current query</p>
                    <p className="mt-2 text-base text-(--ink-muted)">
                      Showing results for <span className="font-semibold text-(--ink)">{query}</span>
                    </p>
                    <p className="small-note mt-1">
                      {searchType === "semantic"
                        ? `Semantic search with threshold ${threshold.toFixed(2)}`
                        : "Exact keyword search across the catalog"}
                    </p>
                  </div>
                  {results.length > 0 && saveMode === "idle" && (
                    <Button onClick={handleSaveSearch} variant="secondary">
                      <Save className="size-4" />
                      Save Search
                    </Button>
                  )}
                  {saveMode === "saved" && (
                    <div className="flex items-center gap-2 rounded-full border border-(--brand) bg-(--brand-soft) px-4 py-2 text-sm font-semibold text-(--brand-strong)">
                      <Check className="size-4" />
                      Saved
                    </div>
                  )}
                </div>

                {(saveMode === "naming" || saveMode === "saving" || saveMode === "error") && (
                  <div className="rounded-3xl border border-(--line) bg-(--surface-muted) p-4 space-y-3">
                    <p className="text-sm font-semibold text-(--ink)">Name this search</p>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="e.g. LLM safety papers"
                        value={saveName}
                        onChange={(event) => setSaveName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            void handleConfirmSave();
                          }
                          if (event.key === "Escape") {
                            handleCancelSave();
                          }
                        }}
                        autoFocus
                        className="flex-1"
                      />
                      <Button
                        onClick={() => void handleConfirmSave()}
                        disabled={!saveName.trim() || saveMode === "saving"}
                      >
                        {saveMode === "saving" ? "Saving…" : "Save"}
                      </Button>
                      <Button onClick={handleCancelSave} variant="ghost" size="icon" aria-label="Cancel save search">
                        <X className="size-4" />
                      </Button>
                    </div>
                    {saveMode === "error" && saveError && (
                      <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
                    )}
                  </div>
                )}
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
                    <h2 className="text-2xl font-semibold text-(--ink)">Search across 1,000+ AI and ML feeds.</h2>
                  </div>
                </div>
                <p className="hero-copy max-w-2xl">
                  Use the search bar above to move from broad discovery to a workable shortlist.
                  Saved searches help you keep recurring monitoring queries one click away.
                </p>
                <SearchArtworkSlot
                  {...SEARCH_ARTWORKS.startHereOnboarding}
                  className="mt-6 max-w-3xl"
                  sizes="(min-width: 1280px) 48rem, (min-width: 768px) 70vw, 100vw"
                />
                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-3xl border border-(--line) bg-(--surface) p-4 text-sm text-(--ink-muted)">
                    Use <span className="font-semibold text-(--ink)">full-text</span> when you know the exact terms.
                  </div>
                  <div className="rounded-3xl border border-(--line) bg-(--surface) p-4 text-sm text-(--ink-muted)">
                    Use <span className="font-semibold text-(--ink)">semantic</span> when you want related concepts.
                  </div>
                  <div className="rounded-3xl border border-(--line) bg-(--surface) p-4 text-sm text-(--ink-muted)">
                    Try queries like <span className="font-semibold text-(--ink)">machine learning</span>, <span className="font-semibold text-(--ink)">transformers</span>, or <span className="font-semibold text-(--ink)">pytorch</span>.
                  </div>
                </div>
              </div>
            )}

            {hasSearched && (
              <SearchResults
                results={results}
                searchType={searchType}
                loading={loading}
                onResultClick={handleResultClick}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
