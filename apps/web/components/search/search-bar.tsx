"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

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

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

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
    <div className="surface-card relative w-full overflow-visible">
      <form onSubmit={handleSubmit}>
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-(--ink-muted)">
              <Search className="size-4" />
            </span>
            <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length >= 2 && setShowSuggestions(true)}
            placeholder="Search feeds by title, topic, or keyword..."
            className="h-14 rounded-2xl pl-11 pr-4 text-base"
          />
          </div>
          <Button
            type="submit"
            className="h-14 rounded-2xl px-6"
          >
            <Sparkles className="size-4" />
            Search
          </Button>
        </div>
      </form>

      {/* Autocomplete Suggestions */}
      {showSuggestions && (suggestions.feeds.length > 0 || suggestions.topics.length > 0) && (
        <div
          ref={suggestionsRef}
          className="absolute inset-x-0 top-full z-50 mt-3 max-h-96 overflow-y-auto rounded-5xl border border-(--line) bg-(--surface) p-2 shadow-[0_28px_80px_rgba(15,23,42,0.18)]"
        >
          {suggestions.feeds.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-(--line)">
              <div className="bg-(--surface-muted) px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-(--ink-muted)">
                Feeds
              </div>
              {suggestions.feeds.map((feed, idx) => (
                <button
                  key={feed.id}
                  type="button"
                  onClick={() => {
                    setQuery(feed.title);
                    onSearch(feed.title);
                    setShowSuggestions(false);
                  }}
                  className={cn(
                    "w-full border-t border-(--line) px-4 py-3 text-left transition duration-150 first:border-t-0 hover:bg-(--surface-muted) focus:bg-(--surface-muted) focus:outline-none",
                    selectedIndex === idx && "bg-(--surface-muted)"
                  )}
                >
                  <div className="font-medium text-(--ink)">{feed.title}</div>
                  <div className="mt-1 truncate text-xs text-(--ink-muted)">{feed.url}</div>
                </button>
              ))}
            </div>
          )}

          {suggestions.topics.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-3xl border border-(--line)">
              <div className="bg-(--surface-muted) px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-(--ink-muted)">
                Topics
              </div>
              {suggestions.topics.map((topic, idx) => (
                <button
                  key={topic.label}
                  type="button"
                  onClick={() => {
                    setQuery(topic.label.toLowerCase());
                    onSearch(topic.label.toLowerCase());
                    setShowSuggestions(false);
                  }}
                  className={cn(
                    "w-full border-t border-(--line) px-4 py-3 text-left transition duration-150 first:border-t-0 hover:bg-(--surface-muted) focus:bg-(--surface-muted) focus:outline-none",
                    selectedIndex === suggestions.feeds.length + idx && "bg-(--surface-muted)"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-(--ink)">{topic.label}</span>
                    <span className="text-xs text-(--ink-muted)">{topic.feed_count} feeds</span>
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
