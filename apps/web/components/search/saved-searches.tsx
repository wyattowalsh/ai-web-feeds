"use client";

import { useEffect, useState } from "react";

interface SavedSearch {
  id: string;
  search_name: string;
  query_text: string;
  filters: Record<string, any>;
  created_at: string;
  last_used_at: string;
}

export function SavedSearches({
  userId,
  onLoadSearch,
}: {
  userId: string;
  onLoadSearch: (query: string, filters: Record<string, any>) => void;
}) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchName, setSearchName] = useState("");

  // Load saved searches
  useEffect(() => {
    loadSearches();
  }, [userId]);

  const loadSearches = async () => {
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
  };

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
        setSearches(searches.filter((s) => s.id !== searchId));
      }
    } catch (error) {
      console.error("Failed to delete saved search:", error);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-gray-700 mb-3">Saved Searches</h3>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded h-16 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-700">Saved Searches</h3>
        <span className="text-xs text-gray-500">{searches.length} saved</span>
      </div>

      {searches.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No saved searches yet</p>
          <p className="text-xs mt-1">Save a search to quickly access it later</p>
        </div>
      ) : (
        <div className="space-y-2">
          {searches.map((search) => (
            <div
              key={search.id}
              className="group flex items-start justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
            >
              <button onClick={() => handleLoadSearch(search)} className="flex-1 text-left">
                <p className="font-medium text-gray-900 text-sm">{search.search_name}</p>
                <p className="text-xs text-gray-600 truncate">{search.query_text}</p>
                {Object.keys(search.filters).length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {Object.keys(search.filters).length} filter
                    {Object.keys(search.filters).length !== 1 ? "s" : ""} applied
                  </p>
                )}
              </button>
              <button
                onClick={() => handleDeleteSearch(search.id)}
                className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800 text-xs px-2 py-1"
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
