"use client";

import { useCallback, useState } from "react";
import { Search, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

export type SearchFilters = {
  unreadOnly: boolean;
  starredOnly: boolean;
  topics: string[];
};

export type AdvancedSearchPanelProps = {
  initialQuery?: string;
  loading?: boolean;
  elapsedMs?: number | null;
  onSearch: (query: string, filters: SearchFilters) => void;
  className?: string;
};

export function AdvancedSearchPanel({
  initialQuery = "",
  loading = false,
  elapsedMs = null,
  onSearch,
  className,
}: AdvancedSearchPanelProps) {
  const [query, setQuery] = useState(initialQuery);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [topic, setTopic] = useState("");

  const submit = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    onSearch(trimmed, {
      unreadOnly,
      starredOnly,
      topics: topic.trim() ? [topic.trim()] : [],
    });
  }, [onSearch, query, starredOnly, topic, unreadOnly]);

  return (
    <div className={cn("surface-card space-y-4 p-4", className)}>
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--ink-muted)" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cached articles…"
            className="pl-10"
            aria-label="Advanced search query"
          />
        </div>
        <Button type="submit" disabled={loading || query.trim().length === 0}>
          {loading ? "Searching…" : "Search cached"}
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => setUnreadOnly(event.target.checked)}
          />
          Unread only
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={starredOnly}
            onChange={(event) => setStarredOnly(event.target.checked)}
          />
          Starred only
        </label>
        <Input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Topic filter"
          className="max-w-[12rem]"
          aria-label="Topic filter"
        />
        {elapsedMs !== null ? (
          <span className="inline-flex items-center gap-1 text-(--ink-muted)">
            <Timer className="size-3.5" aria-hidden />
            {elapsedMs.toFixed(1)} ms
          </span>
        ) : null}
      </div>
    </div>
  );
}
