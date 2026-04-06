"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, RadioTower, Search as SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import type { FeedSource } from "@/lib/feeds-filters";
import { filterBySourceType, filterByVerified, getTopics, filterByTopic } from "@/lib/feeds-filters";
import { normalizeSearchQuery, parseVerifiedSearchFilter } from "@/lib/search";

interface FeedCatalogProps {
  feeds: FeedSource[];
  sourceTypes: string[];
  initialQuery: string;
  initialSourceType: string | null;
  initialTopic: string | null;
  initialVerified: boolean | null;
}

function buildFilteredExportHref(feedIds: string[]): string | null {
  if (feedIds.length === 0) {
    return null;
  }

  const params = new URLSearchParams();
  params.set("format", "filtered");
  for (const feedId of feedIds) {
    params.append("feed", feedId);
  }

  return `/api/exports/opml?${params.toString()}`;
}

function buildActiveFilterSummary({
  query,
  sourceType,
  topic,
  verified,
}: {
  query: string;
  sourceType: string | null;
  topic: string | null;
  verified: boolean | null;
}): string {
  const parts: string[] = [];

  if (query) {
    parts.push(`Query "${query}"`);
  }
  if (sourceType) {
    parts.push(`Type ${sourceType}`);
  }
  if (topic) {
    parts.push(`Topic ${topic}`);
  }
  if (verified === true) {
    parts.push("Verified only");
  } else if (verified === false) {
    parts.push("Unverified only");
  }

  return parts.length > 0 ? parts.join(" · ") : "No filters applied";
}

export function FeedCatalog({
  feeds,
  sourceTypes,
  initialQuery,
  initialSourceType,
  initialTopic,
  initialVerified,
}: FeedCatalogProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedType, setSelectedType] = useState<string | null>(initialSourceType);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(initialTopic);
  const [verifiedFilter, setVerifiedFilter] = useState<boolean | null>(initialVerified);
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);

  useEffect(() => {
    const nextQuery = normalizeSearchQuery(searchParams.get("q")) ?? "";
    const nextSourceType = searchParams.get("source_type")?.trim() || null;
    const nextTopic = searchParams.get("topic")?.trim() || null;
    const nextVerified = parseVerifiedSearchFilter(searchParams.get("verified")) ?? null;

    setSearchQuery(nextQuery);
    setSelectedType(nextSourceType);
    setSelectedTopic(nextTopic);
    setVerifiedFilter(nextVerified);
  }, [searchParams]);

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

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
    result = filterByVerified(result, verifiedFilter);

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (feed) =>
          feed.title?.toLowerCase().includes(query) ||
          feed.description?.toLowerCase().includes(query) ||
          feed.url.toLowerCase().includes(query) ||
          feed.website_url?.toLowerCase().includes(query) ||
          feed.source_type?.toLowerCase().includes(query) ||
          feed.topics?.some((topic) => topic.toLowerCase().includes(query)),
      );
    }

    return result;
  }, [feeds, searchQuery, selectedTopic, selectedType, verifiedFilter]);

  const visibleFeedIds = useMemo(
    () =>
      filteredFeeds
        .map((feed) => feed.id)
        .filter((feedId): feedId is string => typeof feedId === "string" && feedId.length > 0),
    [filteredFeeds],
  );
  const visibleExportHref = useMemo(() => buildFilteredExportHref(visibleFeedIds), [visibleFeedIds]);
  const activeFilterSummary = useMemo(
    () =>
      buildActiveFilterSummary({
        query: searchQuery,
        sourceType: selectedType,
        topic: selectedTopic,
        verified: verifiedFilter,
      }),
    [searchQuery, selectedTopic, selectedType, verifiedFilter],
  );

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
              placeholder="Search feeds by title, description, topic, or URL..."
              value={searchQuery}
              onChange={(event) => {
                const nextValue = event.target.value;
                setSearchQuery(nextValue);
                setParam("q", normalizeSearchQuery(nextValue));
              }}
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
              onClick={() => {
                setSelectedType(null);
                setParam("source_type", null);
              }}
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
                  onClick={() => {
                    setSelectedType(type);
                    setParam("source_type", type);
                  }}
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
                onClick={() => {
                  setSelectedTopic(null);
                  setParam("topic", null);
                }}
              >
                All Topics
              </Button>
              {allTopics.slice(0, 10).map((topic) => (
                <Button
                  key={topic}
                  variant={selectedTopic === topic ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedTopic(topic);
                    setParam("topic", topic);
                  }}
                >
                  {topic}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="field-label">Verification</label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={verifiedFilter === null ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setVerifiedFilter(null);
                setParam("verified", null);
              }}
            >
              Any
            </Button>
            <Button
              variant={verifiedFilter === true ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setVerifiedFilter(true);
                setParam("verified", "true");
              }}
            >
              Verified
            </Button>
            <Button
              variant={verifiedFilter === false ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setVerifiedFilter(false);
                setParam("verified", "false");
              }}
            >
              Unverified
            </Button>
          </div>
        </div>
      </div>

      <div className="surface-card flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 text-sm text-(--ink-muted)">
          <p>
            Showing <strong>{filteredFeeds.length}</strong> of <strong>{feeds.length}</strong> feeds
          </p>
          <p>{activeFilterSummary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleExportHref ? (
            <a
              href={visibleExportHref}
              className="inline-flex items-center gap-2 rounded-2xl border border-(--line) px-4 py-2 text-sm font-medium text-(--ink) hover:bg-(--surface-muted)"
            >
              Export visible OPML
            </a>
          ) : null}
        </div>
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
                {feed.id ? (
                  <Link
                    href={`/reader?feed=${encodeURIComponent(feed.id)}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-(--brand-strong) hover:underline"
                  >
                    <RadioTower className="size-3.5" />
                    Open in reader
                  </Link>
                ) : null}
                {feed.id ? (
                  <a
                    href={buildFilteredExportHref([feed.id]) ?? "#"}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-(--brand-strong) hover:underline"
                  >
                    Export OPML
                  </a>
                ) : null}
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
