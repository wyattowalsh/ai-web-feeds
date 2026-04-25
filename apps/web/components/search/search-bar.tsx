"use client";

import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { normalizeSearchQuery } from "@/lib/search";

interface AutocompleteSuggestion {
  feeds: Array<{ id: string; title: string; type: string; url: string }>;
  topics: Array<{ label: string; type: string; feed_count: number }>;
}

type SuggestionItem =
  | { kind: "feed"; id: string; title: string; url: string }
  | { kind: "topic"; id: string; label: string; feed_count: number };
type FeedSuggestionItem = Extract<SuggestionItem, { kind: "feed" }>;
type TopicSuggestionItem = Extract<SuggestionItem, { kind: "topic" }>;

function buildSuggestionId(kind: SuggestionItem["kind"], seed: string, index: number): string {
  const normalizedSeed =
    seed
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item";

  return `${kind}-${normalizedSeed}-${index}`;
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
  const suggestionsRef = useRef<HTMLElement>(null);
  const autocompleteRequestSequenceRef = useRef(0);
  const listboxId = "search-autocomplete-listbox";

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const feedSuggestions: FeedSuggestionItem[] = suggestions.feeds.map((feed, index) => ({
    kind: "feed" as const,
    id: buildSuggestionId("feed", feed.id || feed.title, index),
    title: feed.title,
    url: feed.url,
  }));
  const topicSuggestions: TopicSuggestionItem[] = suggestions.topics.map((topic, index) => ({
    kind: "topic" as const,
    id: buildSuggestionId("topic", topic.label, index),
    label: topic.label,
    feed_count: topic.feed_count,
  }));
  const suggestionItems: SuggestionItem[] = [...feedSuggestions, ...topicSuggestions];
  const totalSuggestions = suggestionItems.length;

  const selectSuggestion = (suggestion: SuggestionItem) => {
    if (suggestion.kind === "feed") {
      const normalizedTitle = normalizeSearchQuery(suggestion.title) ?? suggestion.title;
      setQuery(normalizedTitle);
      onSearch(normalizedTitle);
    } else {
      const topicQuery =
        normalizeSearchQuery(suggestion.label.toLowerCase()) ?? suggestion.label.toLowerCase();
      setQuery(topicQuery);
      onSearch(topicQuery);
    }

    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  // Fetch autocomplete suggestions
  useEffect(() => {
    const normalizedQuery = normalizeSearchQuery(query);
    if (!normalizedQuery || normalizedQuery.length < 2) {
      autocompleteRequestSequenceRef.current += 1;
      setSuggestions({ feeds: [], topics: [] });
      setShowSuggestions(false);
      setSelectedIndex(-1);
      return;
    }

    const requestSequence = autocompleteRequestSequenceRef.current + 1;
    autocompleteRequestSequenceRef.current = requestSequence;
    const abortController = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search/autocomplete?prefix=${encodeURIComponent(normalizedQuery)}`,
          { signal: abortController.signal },
        );
        if (response.ok) {
          const data = await response.json();
          if (autocompleteRequestSequenceRef.current !== requestSequence) {
            return;
          }

          setSuggestions(data);
          setShowSuggestions((data.feeds?.length ?? 0) + (data.topics?.length ?? 0) > 0);
          setSelectedIndex(-1);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("Autocomplete error:", error);
      }
    }, 300); // Debounce 300ms

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!showSuggestions && totalSuggestions > 0) {
        setShowSuggestions(true);
      }
      setSelectedIndex((prev) => {
        if (totalSuggestions === 0) {
          return -1;
        }

        return prev < totalSuggestions - 1 ? prev + 1 : totalSuggestions - 1;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < totalSuggestions) {
        const selected = suggestionItems[selectedIndex];
        if (selected) {
          selectSuggestion(selected);
        }
      } else {
        const normalizedQuery = normalizeSearchQuery(query);
        if (normalizedQuery) {
          setQuery(normalizedQuery);
          onSearch(normalizedQuery);
        }
        setShowSuggestions(false);
        setSelectedIndex(-1);
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
    const normalizedQuery = normalizeSearchQuery(query);
    if (normalizedQuery) {
      setQuery(normalizedQuery);
      onSearch(normalizedQuery);
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
              onFocus={() =>
                (normalizeSearchQuery(query)?.length ?? 0) >= 2 &&
                totalSuggestions > 0 &&
                setShowSuggestions(true)
              }
              placeholder="Search feeds by title, topic, or keyword..."
              className="h-14 rounded-2xl pl-11 pr-4 text-base"
              role="combobox"
              aria-label="Search feeds"
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-expanded={showSuggestions && totalSuggestions > 0}
              aria-controls={listboxId}
              aria-activedescendant={
                selectedIndex >= 0 && selectedIndex < totalSuggestions
                  ? suggestionItems[selectedIndex]?.id
                  : undefined
              }
            />
          </div>
          <Button type="submit" className="h-14 rounded-2xl px-6">
            <Sparkles className="size-4" aria-hidden="true" />
            Search
          </Button>
        </div>
      </form>

      {/* Autocomplete Suggestions */}
      {showSuggestions && totalSuggestions > 0 && (
        <section
          ref={suggestionsRef}
          id={listboxId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute inset-x-0 top-full z-50 mt-3 max-h-96 overflow-y-auto rounded-5xl border border-(--line) bg-(--surface) p-2 shadow-[0_28px_80px_rgba(15,23,42,0.18)]"
        >
          {suggestions.feeds.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-(--line)">
              <div className="bg-(--surface-muted) px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-(--ink-muted)">
                Feeds
              </div>
              {feedSuggestions.map((feed, idx) => (
                <button
                  key={feed.id}
                  type="button"
                  role="option"
                  id={feed.id}
                  tabIndex={-1}
                  aria-selected={selectedIndex === idx}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSuggestion(feed)}
                  className={cn(
                    "w-full border-t border-(--line) px-4 py-3 text-left transition duration-150 first:border-t-0 hover:bg-(--surface-muted) focus:bg-(--surface-muted) focus:outline-none",
                    selectedIndex === idx && "bg-(--surface-muted)",
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
              {topicSuggestions.map((topic, idx) => (
                <button
                  key={topic.id}
                  type="button"
                  role="option"
                  id={topic.id}
                  tabIndex={-1}
                  aria-selected={selectedIndex === feedSuggestions.length + idx}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSuggestion(topic)}
                  className={cn(
                    "w-full border-t border-(--line) px-4 py-3 text-left transition duration-150 first:border-t-0 hover:bg-(--surface-muted) focus:bg-(--surface-muted) focus:outline-none",
                    selectedIndex === feedSuggestions.length + idx && "bg-(--surface-muted)",
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
        </section>
      )}
    </div>
  );
}
