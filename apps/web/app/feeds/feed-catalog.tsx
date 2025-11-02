"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { FeedSource } from "@/lib/feeds";
import { filterBySourceType, filterByVerified, getTopics, filterByTopic } from "@/lib/feeds";

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
    <div>
      {/* Filters */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Filters</h2>

        {/* Search */}
        <div className="mb-4">
          <label htmlFor="search" className="block text-sm font-medium mb-2">
            Search
          </label>
          <input
            id="search"
            type="text"
            placeholder="Search feeds by title, description, or URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Source Type Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Source Type</label>
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

        {/* Topic Filter */}
        {allTopics.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Topic</label>
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

        {/* Verified Filter */}
        <div className="flex items-center gap-2">
          <input
            id="verified"
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="verified" className="text-sm font-medium">
            Show only verified feeds
          </label>
        </div>
      </div>

      {/* Results */}
      <div className="mb-4 text-sm text-muted-foreground">
        Showing {filteredFeeds.length} of {feeds.length} feeds
      </div>

      {/* Feed Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFeeds.map((feed, idx) => (
          <div
            key={feed.url + idx}
            className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-lg">{feed.title}</h3>
              <div className="flex gap-2 flex-shrink-0">
                {feed.verified && (
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full font-medium">
                    ✓ Verified
                  </span>
                )}
                {!feed.is_active && (
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                    Inactive
                  </span>
                )}
              </div>
            </div>

            {feed.description && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{feed.description}</p>
            )}

            <div className="space-y-2 text-sm">
              {feed.source_type && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                    {feed.source_type}
                  </span>
                </div>
              )}

              {feed.topics && feed.topics.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {feed.topics.slice(0, 3).map((topic) => (
                    <span
                      key={topic}
                      className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-xs"
                    >
                      {topic}
                    </span>
                  ))}
                  {feed.topics.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{feed.topics.length - 3} more
                    </span>
                  )}
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <a
                  href={feed.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Feed URL →
                </a>
                {feed.website_url && (
                  <a
                    href={feed.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Website →
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredFeeds.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No feeds found matching your filters. Try adjusting your search criteria.
        </div>
      )}
    </div>
  );
}
