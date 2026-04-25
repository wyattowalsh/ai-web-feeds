"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SavedSearchFilters {
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

export function SavedSearches({
  userId,
  onLoadSearch,
}: {
  userId: string;
  onLoadSearch: (query: string, filters: SavedSearchFilters) => void;
}) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSearches = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/search/saved?user_id=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setSearches(data);
      }
    } catch (error) {
      console.error("Failed to load saved searches:", error);
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
    if (!confirm("Are you sure you want to delete this saved search?")) return;

    try {
      const response = await fetch(`/api/search/saved?id=${searchId}&user_id=${userId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setSearches((currentSearches) =>
          currentSearches.filter((search) => search.id !== searchId),
        );
      }
    } catch (error) {
      console.error("Failed to delete saved search:", error);
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
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
