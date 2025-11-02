"use client";

import { useState, useEffect, useRef } from "react";

interface AutocompleteSuggestion {
  feeds: Array<{ id: string; title: string; type: string; url: string }>;
  topics: Array<{ label: string; type: string; feed_count: number }>;
}

export function SearchBar({
  onSearch,
  initialQuery = "",
}: {
  onSearch: (query: string) => void;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion>({ feeds: [], topics: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch autocomplete suggestions
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions({ feeds: [], topics: [] });
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search/autocomplete?prefix=${encodeURIComponent(query)}`,
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error("Autocomplete error:", error);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(timer);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalSuggestions = suggestions.feeds.length + suggestions.topics.length;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < totalSuggestions - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < totalSuggestions) {
        // Select suggestion
        const allSuggestions = [...suggestions.feeds, ...suggestions.topics];
        const selected = allSuggestions[selectedIndex];
        if ("title" in selected) {
          setQuery(selected.title);
          onSearch(selected.title);
        } else {
          setQuery(selected.label.toLowerCase());
          onSearch(selected.label.toLowerCase());
        }
        setShowSuggestions(false);
      } else {
        onSearch(query);
        setShowSuggestions(false);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length >= 2 && setShowSuggestions(true)}
            placeholder="Search feeds by title, topic, or keyword..."
            className="w-full px-4 py-3 pl-12 pr-24 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">🔍</span>
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Search
          </button>
        </div>
      </form>

      {/* Autocomplete Suggestions */}
      {showSuggestions && (suggestions.feeds.length > 0 || suggestions.topics.length > 0) && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto"
        >
          {suggestions.feeds.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                Feeds
              </div>
              {suggestions.feeds.map((feed, idx) => (
                <button
                  key={feed.id}
                  onClick={() => {
                    setQuery(feed.title);
                    onSearch(feed.title);
                    setShowSuggestions(false);
                  }}
                  className={`w-full px-4 py-2 text-left hover:bg-blue-50 focus:outline-none focus:bg-blue-50 ${
                    selectedIndex === idx ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="font-medium text-gray-900">{feed.title}</div>
                  <div className="text-xs text-gray-500 truncate">{feed.url}</div>
                </button>
              ))}
            </div>
          )}

          {suggestions.topics.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50 border-t">
                Topics
              </div>
              {suggestions.topics.map((topic, idx) => (
                <button
                  key={topic.label}
                  onClick={() => {
                    setQuery(topic.label.toLowerCase());
                    onSearch(topic.label.toLowerCase());
                    setShowSuggestions(false);
                  }}
                  className={`w-full px-4 py-2 text-left hover:bg-blue-50 focus:outline-none focus:bg-blue-50 ${
                    selectedIndex === suggestions.feeds.length + idx ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{topic.label}</span>
                    <span className="text-xs text-gray-500">{topic.feed_count} feeds</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
