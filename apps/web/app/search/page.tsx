"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Compass, Save, Search as SearchIcon, Sparkles } from "lucide-react";
import { SearchBar } from "@/components/search/search-bar";
import { SearchFilters } from "@/components/search/search-filters";
import { SearchResults } from "@/components/search/search-results";
import { SavedSearches } from "@/components/search/saved-searches";
import { Button } from "@/components/ui/button";
import { getUserId } from "@/lib/user-identity";

type SearchType = "full_text" | "semantic";

const DEFAULT_THRESHOLD = 0.7;

interface SearchResult {
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
  source_type?: string;
  topics?: string[];
  verified?: boolean;
  threshold?: number;
}

interface SearchExecutionState extends SavedSearchFilters {
  searchType: SearchType;
  topics: string[];
  threshold: number;
}

function parseVerifiedParam(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined;
  }

  return value === "true";
}

function parseThresholdParam(value: string | null): number {
  const parsed = Number.parseFloat(value ?? "");

  return Number.isFinite(parsed) ? parsed : DEFAULT_THRESHOLD;
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

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Search state
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [searchType, setSearchType] = useState<SearchType>(
    (searchParams.get("type") as SearchType) || "full_text",
  );
  const [sourceType, setSourceType] = useState<string | undefined>(
    searchParams.get("source_type") || undefined,
  );
  const [topics, setTopics] = useState<string[]>(
    searchParams.get("topics")?.split(",").filter(Boolean) || [],
  );
  const [verified, setVerified] = useState<boolean | undefined>(parseVerifiedParam(searchParams.get("verified")));
  const [threshold, setThreshold] = useState(parseThresholdParam(searchParams.get("threshold")));

  // Results state
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // User ID (localStorage for Phase 1)
  const [userId, setUserId] = useState<string>("");
  const hasInitializedRef = useRef(false);

  const ensureUserId = useCallback(() => {
    const activeUserId = userId || getUserId();

    if (activeUserId !== userId) {
      setUserId(activeUserId);
    }

    return activeUserId;
  }, [userId]);

  const performSearch = useCallback(async (
    searchQuery: string,
    overrides: Partial<SearchExecutionState> = {},
    requestUserId?: string,
  ) => {
    if (!searchQuery.trim()) return;

    const effectiveSearchType = overrides.searchType ?? searchType;
    const effectiveSourceType = "source_type" in overrides ? overrides.source_type : sourceType;
    const effectiveTopics = "topics" in overrides ? (overrides.topics ?? []) : topics;
    const effectiveVerified = "verified" in overrides ? overrides.verified : verified;
    const effectiveThreshold = typeof overrides.threshold === "number" ? overrides.threshold : threshold;
    const activeUserId = requestUserId ?? ensureUserId();

    setLoading(true);
    setHasSearched(true);

    // Update URL
    const params = new URLSearchParams();
    params.set("q", searchQuery);
    params.set("type", effectiveSearchType);
    if (effectiveSourceType) params.set("source_type", effectiveSourceType);
    if (effectiveTopics.length > 0) params.set("topics", effectiveTopics.join(","));
    if (effectiveVerified !== undefined) params.set("verified", String(effectiveVerified));
    if (effectiveSearchType === "semantic") params.set("threshold", String(effectiveThreshold));

    router.push(`/search?${params.toString()}`);

    try {
      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) throw new Error("Search failed");

      const data = await response.json();
      setResults(data.results || []);

      // Log search
      await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          type: effectiveSearchType,
          filters: {
            source_type: effectiveSourceType,
            topics: effectiveTopics,
            verified: effectiveVerified,
            threshold: effectiveThreshold,
          },
          clicked_results: [],
          user_id: activeUserId,
        }),
      });
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [ensureUserId, router, searchType, sourceType, threshold, topics, verified]);

  useEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;

    const activeUserId = ensureUserId();
    const initialQuery = searchParams.get("q");

    if (initialQuery) {
      void performSearch(initialQuery, {}, activeUserId);
    }
  }, [ensureUserId, performSearch, searchParams]);

  const handleSearch = (newQuery: string) => {
    setQuery(newQuery);
    void performSearch(newQuery);
  };

  const handleLoadSavedSearch = (savedQuery: string, savedFilters: SavedSearchFilters) => {
    const nextFilters: SavedSearchFilters = {
      source_type: savedFilters.source_type,
      topics: savedFilters.topics ?? [],
      verified: savedFilters.verified,
      threshold: typeof savedFilters.threshold === "number" ? savedFilters.threshold : DEFAULT_THRESHOLD,
    };

    setQuery(savedQuery);
    setSourceType(nextFilters.source_type);
    setTopics(nextFilters.topics ?? []);
    setVerified(nextFilters.verified);
    setThreshold(nextFilters.threshold ?? DEFAULT_THRESHOLD);
    void performSearch(savedQuery, nextFilters);
  };

  const handleResultClick = async (feedId: string) => {
    const activeUserId = ensureUserId();

    // Log click for analytics
    await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        type: searchType,
        filters: { source_type: sourceType, topics, verified, threshold },
        clicked_results: [feedId],
        user_id: activeUserId,
      }),
    });
  };

  const handleSaveSearch = async () => {
    const name = prompt("Enter a name for this search:");
    if (!name) return;

    try {
      const activeUserId = ensureUserId();
      const response = await fetch("/api/search/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: activeUserId,
          search_name: name,
          query_text: query,
          filters: { source_type: sourceType, topics, verified, threshold },
        }),
      });

      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response, "Failed to save search. Please try again."));
      }

      alert("Search saved successfully!");
    } catch (error) {
      console.error("Failed to save search:", error);
      alert(error instanceof Error ? error.message : "Failed to save search. Please try again.");
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
              <div className="surface-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                {results.length > 0 && (
                  <Button onClick={handleSaveSearch} variant="secondary">
                    <Save className="size-4" />
                    Save Search
                  </Button>
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

            <SearchResults
              results={results}
              searchType={searchType}
              loading={loading}
              onResultClick={handleResultClick}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="page-wrap py-16" />}>
      <SearchPageContent />
    </Suspense>
  );
}
