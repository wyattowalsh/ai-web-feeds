"use client";

import { useState, useMemo } from "react";
import { ExternalLink, Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import type { FeedSource } from "@/lib/feeds-filters";
import { filterBySourceType, filterByVerified, getTopics, filterByTopic } from "@/lib/feeds-filters";

interface FeedCatalogProps {
  feeds: FeedSource[];
  sourceTypes: string[];
}

export function FeedCatalog({ feeds, sourceTypes }: FeedCatalogProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Get all topics from feeds
  const allTopics = useMemo(() => getTopics(feeds), [feeds]);

  // Apply filters
  const filteredFeeds = useMemo(() => {
    let result = feeds;

    // Filter by source type
    result = filterBySourceType(result, selectedType);

    // Filter by topic
    result = filterByTopic(result, selectedTopic);

    // Filter by verification
    result = filterByVerified(result, verifiedOnly ? true : null);

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (feed) =>
          feed.title?.toLowerCase().includes(query) ||
          feed.description?.toLowerCase().includes(query) ||
          feed.url.toLowerCase().includes(query),
      );
    }

    return result;
  }, [feeds, selectedType, selectedTopic, verifiedOnly, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="surface-card space-y-6 xl:sticky xl:top-24 xl:z-10">
        <div>
          <p className="metric-label">Filters</p>
          <h2 className="mt-2 text-title-medium font-semibold text-(--ink)">Narrow the catalog</h2>
        </div>

        <div>
          <label htmlFor="search" className="field-label">
            Search
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-(--ink-muted)">
              <SearchIcon className="size-4" />
            </span>
            <Input
            id="search"
            type="text"
            placeholder="Search feeds by title, description, or URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11"
          />
          </div>
        </div>

        <div>
          <label className="field-label">Source Type</label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedType === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType(null)}
            >
              All ({feeds.length})
            </Button>
            {sourceTypes.map((type) => {
              const count = feeds.filter((f) => f.source_type === type).length;
              return (
                <Button
                  key={type}
                  variant={selectedType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType(type)}
                >
                  {type} ({count})
                </Button>
              );
            })}
          </div>
        </div>

        {allTopics.length > 0 && (
          <div>
            <label className="field-label">Topic</label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedTopic === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTopic(null)}
              >
                All Topics
              </Button>
              {allTopics.slice(0, 10).map((topic) => (
                <Button
                  key={topic}
                  variant={selectedTopic === topic ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTopic(topic)}
                >
                  {topic}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            id="verified"
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="h-4 w-4 rounded border-(--line) text-(--brand)"
          />
          <label htmlFor="verified" className="text-sm font-medium text-(--ink)">
            Show only verified feeds
          </label>
        </div>
      </div>

      <div className="surface-card flex items-center justify-between text-sm text-(--ink-muted)">
        Showing {filteredFeeds.length} of {feeds.length} feeds
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredFeeds.map((feed, idx) => (
          <div
            key={feed.url + idx}
            className="surface-card transition duration-150 hover:-translate-y-0.5"
          >
            <div className="space-y-4 text-sm">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-lg font-semibold text-(--ink)">{feed.title}</h3>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  {feed.verified && (
                    <span className="rounded-full bg-(--brand-soft) px-2.5 py-1 text-xs font-semibold text-(--brand-strong)">
                      ✓ Verified
                    </span>
                  )}
                  {!feed.is_active && (
                    <span className="rounded-full bg-(--surface-muted) px-2.5 py-1 text-xs font-semibold text-(--ink-muted)">
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              {feed.description && (
                <p className="line-clamp-2 text-sm text-(--ink-muted)">{feed.description}</p>
              )}

              {feed.source_type && (
                <div className="flex items-center gap-2">
                  <span className="text-(--ink-muted)">Type:</span>
                  <span className="rounded-full border border-(--line) bg-(--surface) px-2.5 py-1 text-xs font-semibold text-(--ink-muted)">
                    {feed.source_type}
                  </span>
                </div>
              )}

              {feed.topics && feed.topics.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {feed.topics.slice(0, 3).map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full bg-(--brand-soft) px-2.5 py-1 text-xs font-semibold text-(--brand-strong)"
                    >
                      {topic}
                    </span>
                  ))}
                  {feed.topics.length > 3 && (
                    <span className="text-xs text-(--ink-muted)">
                      +{feed.topics.length - 3} more
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-1">
                <a
                  href={feed.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-(--brand-strong) hover:underline"
                >
                  <ExternalLink className="size-3.5" />
                  Feed URL
                </a>
                {feed.website_url && (
                  <a
                    href={feed.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-(--brand-strong) hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    Website
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredFeeds.length === 0 && (
        <EmptyState
          icon={SearchIcon}
          title="No feeds match this filter set"
          description="Try widening the source types, removing topic constraints, or turning off verified-only mode."
          tips={[
            "Use a broader search phrase or clear the topic filter.",
            "Verified-only mode can hide newer additions that have not been reviewed yet.",
          ]}
        />
      )}
    </div>
  );
}
