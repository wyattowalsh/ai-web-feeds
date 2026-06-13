"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, RadioTower, Search as SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SourceAvatar } from "@/components/source-avatar";
import type { FeedSource } from "@/lib/feeds-filters";
import {
  filterBySourceType,
  getTopics,
  filterByTopic,
  filterByVerified,
} from "@/lib/feeds-filters";
import {
  buildReaderRouteHref,
  CANONICAL_CATALOG_PATH,
  CANONICAL_SOURCES_PATH,
} from "@/lib/reader-routes";
import { getSourcePath, getTopicPath } from "@/lib/public-paths";
import { normalizeSearchQuery, parseVerifiedSearchFilter } from "@/lib/search";

interface FeedCatalogProps {
  feeds: FeedSource[];
  sourceTypes: string[];
  initialQuery: string;
  initialSourceType: string | null;
  initialTopic: string | null;
  initialVerified: boolean | null;
}

function buildReaderHref({
  feedIds,
  query,
  sourceType,
  topic,
  verified,
}: {
  feedIds: string[];
  query: string;
  sourceType: string | null;
  topic: string | null;
  verified: boolean | null;
}): string {
  const params = new URLSearchParams();
  const shouldCarryExplicitFeedIds = query.length > 0 || feedIds.length === 1;
  if (shouldCarryExplicitFeedIds) {
    for (const feedId of feedIds) {
      params.append("feed", feedId);
    }
  }

  if (query) {
    params.set("q", query);
  }
  if (sourceType) {
    params.set("source_type", sourceType);
  }
  if (verified !== null) {
    params.set("verified", String(verified));
  }
  if (topic) {
    params.set("topics", topic);
  }

  return buildReaderRouteHref(params);
}

function buildScopedSearchHref({
  feedIds,
  query,
  sourceType,
  topic,
  verified,
}: {
  feedIds: string[];
  query: string;
  sourceType: string | null;
  topic: string | null;
  verified: boolean | null;
}): string {
  const params = new URLSearchParams();
  const shouldCarryExplicitFeedIds = query.length > 0 || feedIds.length === 1;
  if (shouldCarryExplicitFeedIds) {
    for (const feedId of feedIds) {
      params.append("feed", feedId);
    }
  }

  if (query) {
    params.set("q", query);
  }
  if (sourceType) {
    params.set("source_type", sourceType);
  }
  if (topic) {
    params.set("topics", topic);
  }
  if (verified !== null) {
    params.set("verified", String(verified));
  }

  return buildReaderRouteHref(params);
}

function buildFeedArticleSearchHref(feed: FeedSource): string {
  const params = new URLSearchParams();
  params.set("q", feed.title);

  if (feed.source_type) {
    params.set("source_type", feed.source_type);
  }
  if (feed.topics && feed.topics.length > 0) {
    params.set("topics", feed.topics.slice(0, 2).join(","));
  }
  if (feed.verified === true) {
    params.set("verified", "true");
  }

  return buildReaderRouteHref(params);
}

function buildFeedReaderHref({
  feedId,
  query,
  sourceType,
  verified,
}: {
  feedId: string;
  query: string;
  sourceType: string | null;
  verified: boolean | null;
}): string {
  const params = new URLSearchParams();
  params.set("feed", feedId);

  if (query) {
    params.set("q", query);
  }
  if (sourceType) {
    params.set("source_type", sourceType);
  }
  if (verified !== null) {
    params.set("verified", String(verified));
  }

  return buildReaderRouteHref(params);
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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedType, setSelectedType] = useState<string | null>(initialSourceType);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(initialTopic);
  const [verifiedFilter, setVerifiedFilter] = useState<boolean | null>(initialVerified);
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const hasVerificationSignals = useMemo(
    () => feeds.some((feed) => typeof feed.verified === "boolean"),
    [feeds],
  );
  const effectiveVerifiedFilter = hasVerificationSignals ? verifiedFilter : null;

  useEffect(() => {
    const nextQuery = normalizeSearchQuery(searchParams.get("q")) ?? "";
    const nextSourceType = searchParams.get("source_type")?.trim() || null;
    const nextTopic =
      searchParams.get("topics")?.split(",")[0]?.trim() ||
      searchParams.get("topic")?.trim() ||
      null;
    const nextVerified = hasVerificationSignals
      ? parseVerifiedSearchFilter(searchParams.get("verified")) ?? null
      : null;

    setSearchQuery(nextQuery);
    setSelectedType(nextSourceType);
    setSelectedTopic(nextTopic);
    setVerifiedFilter(nextVerified);
  }, [hasVerificationSignals, searchParams]);

  useEffect(() => {
    if (hasVerificationSignals || !searchParams.has("verified")) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("verified");
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${CANONICAL_SOURCES_PATH}?${nextQuery}` : CANONICAL_SOURCES_PATH, {
      scroll: false,
    });
  }, [hasVerificationSignals, router, searchParams]);

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("topic");
    if (!hasVerificationSignals) {
      params.delete("verified");
    }
    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${CANONICAL_SOURCES_PATH}?${nextQuery}` : CANONICAL_SOURCES_PATH, {
      scroll: false,
    });
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
    result = filterByVerified(result, effectiveVerifiedFilter);

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
  }, [effectiveVerifiedFilter, feeds, searchQuery, selectedTopic, selectedType]);

  const visibleFeedIds = useMemo(
    () =>
      filteredFeeds
        .map((feed) => feed.id)
        .filter((feedId): feedId is string => typeof feedId === "string" && feedId.length > 0),
    [filteredFeeds],
  );
  const readerHref = useMemo(
    () =>
      buildReaderHref({
        feedIds: visibleFeedIds,
        query: searchQuery,
        sourceType: selectedType,
        topic: selectedTopic,
        verified: effectiveVerifiedFilter,
      }),
    [effectiveVerifiedFilter, searchQuery, selectedTopic, selectedType, visibleFeedIds],
  );
  const searchHref = useMemo(
    () =>
      buildScopedSearchHref({
        feedIds: visibleFeedIds,
        query: searchQuery,
        sourceType: selectedType,
        topic: selectedTopic,
        verified: effectiveVerifiedFilter,
      }),
    [effectiveVerifiedFilter, searchQuery, selectedTopic, selectedType, visibleFeedIds],
  );
  const resetCatalogHref = CANONICAL_CATALOG_PATH;
  const browsePostsHref = useMemo(
    () =>
      buildReaderHref({
        feedIds: [],
        query: searchQuery,
        sourceType: null,
        topic: null,
        verified: null,
      }),
    [searchQuery],
  );
  const activeFilterSummary = useMemo(
    () =>
      buildActiveFilterSummary({
        query: searchQuery,
        sourceType: selectedType,
        topic: selectedTopic,
        verified: effectiveVerifiedFilter,
      }),
    [effectiveVerifiedFilter, searchQuery, selectedTopic, selectedType],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm xl:sticky xl:top-20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="metric-label">Source catalog</p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">Browse sources</h1>
            <p className="small-note mt-2 max-w-3xl">
              Search the feed list, then jump into the reader for any source or slice.
            </p>
          </div>
          <Badge variant="secondary" className="h-7 rounded-md">
            {feeds.length} sources
          </Badge>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(18rem,1fr)_minmax(0,2fr)]">
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
                aria-pressed={selectedType === null}
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
                    aria-pressed={selectedType === type}
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
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
          {allTopics.length > 0 && (
            <div>
              <label className="field-label">Topic</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedTopic === null ? "default" : "outline"}
                  size="sm"
                  aria-pressed={selectedTopic === null}
                  onClick={() => {
                    setSelectedTopic(null);
                    setParam("topics", null);
                  }}
                >
                  All Topics
                </Button>
                {allTopics.slice(0, 10).map((topic) => (
                  <Button
                    key={topic}
                    variant={selectedTopic === topic ? "default" : "outline"}
                    size="sm"
                    aria-pressed={selectedTopic === topic}
                    onClick={() => {
                      setSelectedTopic(topic);
                      setParam("topics", topic);
                    }}
                  >
                    {topic}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {hasVerificationSignals && (
            <div>
              <label className="field-label">Verification</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={verifiedFilter === null ? "default" : "outline"}
                  size="sm"
                  aria-pressed={verifiedFilter === null}
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
                  aria-pressed={verifiedFilter === true}
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
                  aria-pressed={verifiedFilter === false}
                  onClick={() => {
                    setVerifiedFilter(false);
                    setParam("verified", "false");
                  }}
                >
                  Unverified
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1 text-sm text-(--ink-muted)">
          <p>
            Showing <strong>{filteredFeeds.length}</strong> of <strong>{feeds.length}</strong> feeds
          </p>
          <p>{activeFilterSummary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={readerHref} className={buttonVariants({ variant: "default" })}>
            Read matching feeds
          </Link>
          <Link href={searchHref} className={buttonVariants({ variant: "outline" })}>
            Search recent posts
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredFeeds.map((feed, idx) => (
          <Card
            key={feed.url + idx}
            className="transition duration-150 hover:border-primary/45 hover:bg-muted/25"
          >
            <CardHeader className="gap-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <SourceAvatar source={feed} />
                  <Link
                    href={getSourcePath(feed)}
                    className="break-words text-lg font-semibold text-foreground transition hover:text-primary hover:underline [overflow-wrap:anywhere]"
                  >
                    <CardTitle>{feed.title}</CardTitle>
                  </Link>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  {feed.verified === true && (
                    <Badge variant="secondary" className="h-6 rounded-md">
                      Verified
                    </Badge>
                  )}
                  {feed.is_active === false && (
                    <Badge variant="outline" className="h-6 rounded-md">
                      Inactive
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              {feed.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">{feed.description}</p>
              )}

              {feed.source_type && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Type:</span>
                  <Badge variant="outline" className="h-6 rounded-md">
                    {feed.source_type}
                  </Badge>
                </div>
              )}

              {feed.topics && feed.topics.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {feed.topics.slice(0, 3).map((topic) => (
                    <Link
                      key={topic}
                      href={getTopicPath(topic)}
                      className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-(--brand-strong)"
                    >
                      {topic}
                    </Link>
                  ))}
                  {feed.topics.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{feed.topics.length - 3} more
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3 border-t border-border pt-3">
                {feed.id ? (
                  <Link
                    href={getSourcePath(feed)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-(--brand-strong) hover:underline"
                    aria-label={`View details for ${feed.title}`}
                  >
                    <RadioTower className="size-3.5" />
                    Details
                  </Link>
                ) : null}
                {feed.id ? (
                  <a
                    href={buildFeedReaderHref({
                      feedId: feed.id,
                      query: searchQuery,
                      sourceType: selectedType,
                      verified: effectiveVerifiedFilter,
                    })}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-(--brand-strong) hover:underline"
                    aria-label={`Read ${feed.title} in the reader`}
                  >
                    <RadioTower className="size-3.5" />
                    Read source
                  </a>
                ) : null}
                <Link
                  href={buildFeedArticleSearchHref(feed)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-(--brand-strong) hover:underline"
                  aria-label={`Search recent posts from ${feed.title}`}
                >
                  <SearchIcon className="size-3.5" />
                  Search posts
                </Link>
                <a
                  href={feed.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-(--brand-strong) hover:underline"
                  aria-label={`Open feed URL for ${feed.title}`}
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
                    aria-label={`Open website for ${feed.title}`}
                  >
                    <ExternalLink className="size-3.5" />
                    Website
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredFeeds.length === 0 && (
        <EmptyState
          icon={SearchIcon}
          title="No feeds match this filter set"
          description="Reset to the full catalog, or open the article view to discover posts beyond the current source list."
          tips={
            hasVerificationSignals
              ? [
                  "Use a broader search phrase or clear the topic filter.",
                  "Verified-only mode can hide newer additions that have not been reviewed yet.",
                ]
              : ["Use a broader search phrase or clear the topic filter."]
          }
        >
          <div className="flex flex-wrap justify-center gap-3">
            <Link href={resetCatalogHref} className={buttonVariants({ variant: "default" })}>
              Reset to full catalog
            </Link>
            <Link href={browsePostsHref} className={buttonVariants({ variant: "outline" })}>
              {normalizeSearchQuery(searchQuery)
                ? "Browse posts for this query"
                : "Browse article workspace"}
            </Link>
          </div>
        </EmptyState>
      )}
    </div>
  );
}
