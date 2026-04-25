"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, Trash2, X, Check } from "lucide-react";
import { SearchArtworkSlot, SEARCH_ARTWORKS } from "@/components/search/search-artwork";
import { Button } from "@/components/ui/button";

type SearchType = "full_text" | "semantic";

interface SavedSearchFilters {
  search_type?: SearchType;
  source_type?: string;
  topics?: string[];
  verified?: boolean;
  threshold?: number;
}

interface SavedSearch {
  id: string;
  search_name: string;
  query_text: string;
  filters: SavedSearchFilters;
  created_at: string;
  last_used_at: string;
}

interface SavedSearchesUnavailableResponse {
  searches: SavedSearch[];
  unavailable: true;
  error: string;
}

interface SavedSearchesLoadIssue {
  title: string;
  message: string;
}

function getSavedSearchErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    const errorMessage = payload.error.trim();

    if (errorMessage) {
      return errorMessage;
    }
  }

  return fallback;
}

function isSavedSearchesUnavailableResponse(
  payload: unknown,
): payload is SavedSearchesUnavailableResponse {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as {
    searches?: unknown;
    unavailable?: unknown;
    error?: unknown;
  };

  return (
    Array.isArray(candidate.searches) &&
    candidate.unavailable === true &&
    typeof candidate.error === "string"
  );
}

export function SavedSearches({
  userId,
  onLoadSearch,
}: {
  userId: string;
  onLoadSearch: (query: string, filters: SavedSearchFilters) => void;
}) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadIssue, setLoadIssue] = useState<SavedSearchesLoadIssue | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const loadSearches = useCallback(async () => {
    setLoading(true);
    setLoadIssue(null);

    try {
      const response = await fetch(`/api/search/saved?user_id=${userId}`);
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        setSearches([]);
        setLoadIssue({
          title: "Couldn't load saved searches",
          message: getSavedSearchErrorMessage(
            payload,
            "Failed to load saved searches. Please try again.",
          ),
        });
        return;
      }

      if (Array.isArray(payload)) {
        setSearches(payload as SavedSearch[]);
        setLoadIssue(null);
        return;
      }

      if (isSavedSearchesUnavailableResponse(payload)) {
        setSearches(payload.searches);
        setLoadIssue({
          title: "Saved searches unavailable",
          message: payload.error,
        });
        return;
      }

      setSearches([]);
      setLoadIssue({
        title: "Couldn't load saved searches",
        message: "Saved searches returned an unexpected response.",
      });
    } catch (error) {
      console.error("Failed to load saved searches:", error);
      setSearches([]);
      setLoadIssue({
        title: "Couldn't load saved searches",
        message: "Failed to load saved searches. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Load saved searches
  useEffect(() => {
    void loadSearches();
  }, [loadSearches]);

  const handleLoadSearch = (search: SavedSearch) => {
    onLoadSearch(search.query_text, search.filters);
  };

  const handleDeleteSearch = async (searchId: string) => {
    try {
      const params = new URLSearchParams({
        id: searchId,
        user_id: userId,
      });
      const response = await fetch(`/api/search/saved?${params.toString()}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setSearches((currentSearches) =>
          currentSearches.filter((search) => search.id !== searchId),
        );
      }
    } catch (error) {
      console.error("Failed to delete saved search:", error);
    } finally {
      setPendingDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="surface-card">
        <h3 className="text-lg font-semibold text-(--ink)">Saved Searches</h3>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-3xl bg-(--surface-muted)" />
          ))}
        </div>
      </div>
    );
  }

  if (loadIssue) {
    return (
      <div className="surface-card">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
            <Bookmark className="size-4" />
          </span>
          <div>
            <p className="metric-label">Saved Searches</p>
            <h3 className="text-lg font-semibold text-(--ink)">{loadIssue.title}</h3>
          </div>
        </div>

        <div className="rounded-[2rem] border border-dashed border-(--line) px-6 py-10 text-center text-(--ink-muted)">
          <SearchArtworkSlot
            {...SEARCH_ARTWORKS.savedSearchesEmpty}
            className="mx-auto mb-4 w-full max-w-56"
            sizes="224px"
          />
          <p className="text-sm text-(--ink-muted)">{loadIssue.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
            <Bookmark className="size-4" />
          </span>
          <div>
            <p className="metric-label">Saved Searches</p>
            <h3 className="text-lg font-semibold text-(--ink)">Reusable discovery shortcuts</h3>
          </div>
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-(--ink-muted)">
          {searches.length} saved
        </span>
      </div>

      {searches.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-(--line) px-6 py-10 text-center text-(--ink-muted)">
          <SearchArtworkSlot
            {...SEARCH_ARTWORKS.savedSearchesEmpty}
            className="mx-auto mb-4 w-full max-w-56"
            sizes="224px"
          />
          <p className="text-sm font-semibold text-(--ink)">No saved searches yet</p>
          <p className="mt-1 text-xs">
            Save a search to keep recurring monitoring queries close at hand.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {searches.map((search) => (
            <div
              key={search.id}
              className="group flex items-start justify-between rounded-3xl border border-(--line) bg-(--surface) p-4 transition duration-150 hover:bg-(--surface-muted)"
            >
              <button
                type="button"
                onClick={() => handleLoadSearch(search)}
                className="flex-1 text-left"
              >
                <p className="text-sm font-semibold text-(--ink)">{search.search_name}</p>
                <p className="mt-1 truncate text-xs text-(--ink-muted)">{search.query_text}</p>
                {Object.keys(search.filters).length > 0 && (
                  <p className="mt-2 text-xs text-(--ink-muted)">
                    {Object.keys(search.filters).length} filter
                    {Object.keys(search.filters).length !== 1 ? "s" : ""} applied
                  </p>
                )}
              </button>
              <Button
                type="button"
                onClick={() => handleDeleteSearch(search.id)}
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100"
                title="Delete"
              >
                <button
                  type="button"
                  onClick={() => handleLoadSearch(search)}
                  className="flex-1 text-left"
                >
                  <p className="text-sm font-semibold text-(--ink)">{search.search_name}</p>
                  <p className="mt-1 truncate text-xs text-(--ink-muted)">{search.query_text}</p>
                  {appliedFilterCount > 0 && (
                    <p className="mt-2 text-xs text-(--ink-muted)">
                      {appliedFilterCount} filter
                      {appliedFilterCount !== 1 ? "s" : ""} applied
                    </p>
                  )}
                </button>
                {pendingDelete === search.id ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      onClick={() => void handleDeleteSearch(search.id)}
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700 dark:text-red-400"
                      title="Confirm delete"
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setPendingDelete(null)}
                      variant="ghost"
                      size="icon"
                      title="Cancel"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    onClick={() => setPendingDelete(search.id)}
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100"
                    title="Delete"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
