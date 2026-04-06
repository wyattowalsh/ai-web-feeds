import "server-only";

import { loadAggregatedFeedPostsByIds } from "@/lib/feed-posts";
import { loadFeedCatalog, type FeedSource } from "@/lib/feeds";
import type { SearchResponseMeta, SearchResponsePayload, SearchResult, SearchScope } from "@/lib/search";

export interface LocalSearchOptions {
  query: string;
  scope: SearchScope;
  limit: number;
  sourceType?: string;
  topics?: string[];
  verified?: boolean;
}

const ARTICLE_FEED_SCAN_LIMIT = 18;
const ARTICLE_PER_FEED_LIMIT = 4;
const ARTICLE_TOTAL_LIMIT = 120;

type SearchableFeedSource = FeedSource & {
  notes?: string | null;
  site?: string | null;
};

export async function runLocalSearch(options: LocalSearchOptions): Promise<SearchResponsePayload> {
  const catalog = loadFeedCatalog().sources;
  const filteredFeeds = filterFeeds(catalog, options);

  if (options.scope === "articles") {
    return searchArticles(filteredFeeds, options);
  }

  return {
    scope: "sources",
    results: searchSources(filteredFeeds, options),
    meta: buildUnboundedMeta(filteredFeeds.length),
  };
}

function filterFeeds(feeds: FeedSource[], options: LocalSearchOptions): SearchableFeedSource[] {
  return feeds.filter((feed) => {
    if (options.sourceType && feed.source_type !== options.sourceType) {
      return false;
    }

    if (options.verified !== undefined && feed.verified !== options.verified) {
      return false;
    }

    if (options.topics && options.topics.length > 0) {
      const feedTopics = normalizeList([...normalizeTopics(feed.topics), ...normalizeTopics(feed.tags)]);
      if (!options.topics.some((topic) => feedTopics.includes(topic))) {
        return false;
      }
    }

    return true;
  }) as SearchableFeedSource[];
}

function searchSources(feeds: SearchableFeedSource[], options: LocalSearchOptions): SearchResult[] {
  const query = normalizeText(options.query);

  return feeds
    .map((feed) => {
      const feedTopics = normalizeTopics(feed.topics);
      const matchScore =
        scoreText(query, feed.title, 10) +
        scoreText(query, feed.description, 4) +
        scoreText(query, feed.notes, 4) +
        scoreText(query, feed.url, 2) +
        scoreList(query, feedTopics, 5) +
        scoreList(query, normalizeTopics(feed.tags), 3) +
        scoreText(query, feed.source_type, 2) +
        (feed.verified ? 0.5 : 0) +
        (feed.is_active !== false ? 0.25 : 0);

      return {
        kind: "source" as const,
        id: getFeedIdentifier(feed),
        title: feed.title?.trim() || feed.url,
        description: feed.description || feed.notes,
        url: feed.site || feed.website_url || feed.url,
        topics: feedTopics,
        source_type: feed.source_type || "feed",
        verified: feed.verified === true,
        is_active: feed.is_active !== false,
        match_score: matchScore,
      };
    })
    .filter((result) => result.match_score > 0)
    .sort((left, right) => compareResults(left, right))
    .slice(0, options.limit);
}

async function searchArticles(
  feeds: SearchableFeedSource[],
  options: LocalSearchOptions,
): Promise<SearchResponsePayload> {
  if (feeds.length === 0) {
    return {
      scope: "articles",
      results: [],
      meta: buildBoundedMeta(0, 0),
    };
  }

  const candidateFeeds = feeds
    .map((feed) => ({
      feed,
      score:
        scoreText(options.query, feed.title, 6) +
        scoreText(options.query, feed.description, 2) +
        scoreText(options.query, feed.notes, 2) +
        scoreList(options.query, normalizeTopics(feed.topics), 3) +
        (feed.verified ? 0.25 : 0) +
        (feed.is_active !== false ? 0.25 : 0),
    }))
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      if ((left.feed.verified === true) !== (right.feed.verified === true)) {
        return left.feed.verified === true ? -1 : 1;
      }

      if ((left.feed.is_active !== false) !== (right.feed.is_active !== false)) {
        return left.feed.is_active !== false ? -1 : 1;
      }

      return (left.feed.title || left.feed.url).localeCompare(right.feed.title || right.feed.url);
    })
    .slice(0, ARTICLE_FEED_SCAN_LIMIT)
    .map(({ feed }) => feed);

  const feedLookup = new Map(candidateFeeds.map((feed) => [getFeedIdentifier(feed), feed]));
  const payload = await loadAggregatedFeedPostsByIds(
    candidateFeeds.map(getFeedIdentifier),
    ARTICLE_TOTAL_LIMIT,
    ARTICLE_PER_FEED_LIMIT,
  );

  const results = payload.posts
    .map((post) => {
      const feed = feedLookup.get(post.feedId);
      const feedTopics = normalizeTopics(feed?.topics);
      const matchScore =
        scoreText(options.query, post.title, 10) +
        scoreText(options.query, post.summary, 5) +
        scoreText(options.query, post.author, 2) +
        scoreText(options.query, post.feedTitle, 4) +
        scoreList(options.query, post.categories, 4) +
        scoreList(options.query, feedTopics, 2);

      return {
        kind: "article" as const,
        id: `${post.feedId}:${post.id}`,
        title: post.title,
        description: post.summary || `From ${post.feedTitle}`,
        url: post.link,
        topics: post.categories.length > 0 ? normalizeList(post.categories) : feedTopics,
        source_type: feed?.source_type || "feed",
        verified: feed?.verified === true,
        is_active: feed?.is_active !== false,
        match_score: matchScore,
        feed_id: post.feedId,
        feed_title: post.feedTitle,
        published_at: post.publishedAt,
      };
    })
    .filter((result) => result.match_score > 0)
    .sort((left, right) => compareResults(left, right))
    .slice(0, options.limit);

  return {
    scope: "articles",
    results,
    meta: buildBoundedMeta(feeds.length, candidateFeeds.length),
  };
}

function buildUnboundedMeta(candidateSources: number): SearchResponseMeta {
  return {
    mode: "unbounded",
    bounded: false,
    candidate_sources: candidateSources,
    scanned_sources: candidateSources,
    scan_limit: null,
    per_source_limit: null,
    truncated: false,
  };
}

function buildBoundedMeta(candidateSources: number, scannedSources: number): SearchResponseMeta {
  return {
    mode: "bounded",
    bounded: true,
    candidate_sources: candidateSources,
    scanned_sources: scannedSources,
    scan_limit: ARTICLE_FEED_SCAN_LIMIT,
    per_source_limit: ARTICLE_PER_FEED_LIMIT,
    truncated: candidateSources > scannedSources,
  };
}

function normalizeText(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function normalizeTopics(values: string[] | string | null | undefined): string[] {
  if (!values) {
    return [];
  }

  return normalizeList(Array.isArray(values) ? values : String(values).split(","));
}

function normalizeList(values: readonly string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeText(value))
        .filter((value) => value.length > 0),
    ),
  );
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9+.#/-]+/i)
    .filter((token) => token.length > 0);
}

function scoreText(query: string, text: string | null | undefined, weight: number): number {
  const haystack = normalizeText(text);
  if (!haystack) {
    return 0;
  }

  const normalizedQuery = normalizeText(query);
  const tokens = tokenize(normalizedQuery);
  let score = 0;

  if (normalizedQuery.length > 0 && haystack.includes(normalizedQuery)) {
    score += weight * 4;
  }

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += weight;
      if (haystack.startsWith(token)) {
        score += weight * 0.5;
      }
    }
  }

  return score;
}

function scoreList(query: string, values: readonly string[], weight: number): number {
  return values.reduce((total, value) => total + scoreText(query, value, weight), 0);
}

function compareResults(
  left: SearchResult,
  right: SearchResult,
): number {
  if (left.match_score !== right.match_score) {
    return right.match_score - left.match_score;
  }

  if (left.kind !== right.kind) {
    return left.kind === "source" ? -1 : 1;
  }

  if (left.kind === "article" && right.kind === "article") {
    const leftTime = Date.parse(left.published_at || "");
    const rightTime = Date.parse(right.published_at || "");
    if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
      return rightTime - leftTime;
    }
  }

  if (left.verified !== right.verified) {
    return left.verified ? -1 : 1;
  }

  if (left.is_active !== right.is_active) {
    return left.is_active ? -1 : 1;
  }

  return left.title.localeCompare(right.title);
}

function getFeedIdentifier(feed: FeedSource): string {
  return feed.id || feed.title || feed.url;
}
