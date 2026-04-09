import "server-only";

import { loadAggregatedFeedPostsByIds } from "@/lib/feed-posts";
import { loadFeedCatalog, type FeedSource } from "@/lib/feeds";
import type { SearchFilters, SearchScope } from "@/lib/search";

export interface SearchResultItem {
  id: string;
  kind: SearchScope extends never ? never : "source" | "article";
  title: string;
  description?: string;
  url: string;
  external_url?: string;
  topics: string[];
  source_type: string;
  verified: boolean;
  is_active: boolean;
  published_at?: string | null;
  feed_id?: string;
  feed_title?: string;
}

export interface SearchResponsePayload {
  scope: SearchScope;
  results: SearchResultItem[];
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function feedIdentifier(feed: FeedSource, fallbackIndex: number): string {
  return feed.id || feed.title || feed.url || `feed-${fallbackIndex}`;
}

function normalizeText(value: string | undefined | null): string {
  return (value || "").trim().toLowerCase();
}

function includesAllTerms(text: string, terms: string[]): boolean {
  return terms.every((term) => text.includes(term));
}

function rankMatch(text: string, terms: string[]): number {
  if (!text || terms.length === 0) {
    return 0;
  }

  let score = 0;
  for (const term of terms) {
    if (text === term) {
      score += 8;
    } else if (text.startsWith(term)) {
      score += 5;
    } else if (text.includes(term)) {
      score += 2;
    }
  }

  return score;
}

function matchesFilters(feed: FeedSource, filters: SearchFilters): boolean {
  if (
    filters.source_type &&
    normalizeText(feed.source_type) !== normalizeText(filters.source_type)
  ) {
    return false;
  }

  if (filters.verified !== undefined && Boolean(feed.verified) !== filters.verified) {
    return false;
  }

  if (filters.topics && filters.topics.length > 0) {
    const feedTopics = new Set((feed.topics || []).map((topic) => topic.trim().toLowerCase()));
    if (!filters.topics.every((topic) => feedTopics.has(topic.trim().toLowerCase()))) {
      return false;
    }
  }

  return true;
}

function buildSourceSearchText(feed: FeedSource): string {
  return [
    feed.title,
    feed.description,
    feed.notes,
    feed.source_type,
    ...(feed.topics || []),
    ...(feed.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildSourceResult(feed: FeedSource, fallbackIndex: number): SearchResultItem {
  const id = feedIdentifier(feed, fallbackIndex);
  return {
    id,
    kind: "source",
    title: feed.title,
    description: feed.description || feed.notes,
    url: `/reader?feed=${encodeURIComponent(id)}`,
    external_url: feed.site || feed.url,
    topics: [...(feed.topics || [])],
    source_type: feed.source_type || "feed",
    verified: Boolean(feed.verified),
    is_active: feed.is_active !== false,
    feed_id: id,
    feed_title: feed.title,
  };
}

export async function searchCatalog(
  query: string,
  scope: SearchScope,
  filters: SearchFilters,
  limit = 20,
): Promise<SearchResponsePayload> {
  const catalog = loadFeedCatalog();
  const terms = tokenizeQuery(query);
  const filteredFeeds = catalog.sources.filter((feed) => matchesFilters(feed, filters));

  if (scope === "sources") {
    const results = filteredFeeds
      .map((feed, index) => {
        const titleText = normalizeText(feed.title);
        const bodyText = buildSourceSearchText(feed);
        const score = rankMatch(titleText, terms) * 3 + rankMatch(bodyText, terms);
        return { feed, index, score, bodyText };
      })
      .filter(({ score, bodyText }) => score > 0 || includesAllTerms(bodyText, terms))
      .sort((left, right) => {
        const activeDelta =
          Number(Boolean(right.feed.is_active !== false)) -
          Number(Boolean(left.feed.is_active !== false));
        if (activeDelta !== 0) {
          return activeDelta;
        }

        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.feed.title.localeCompare(right.feed.title, undefined, { sensitivity: "base" });
      })
      .slice(0, limit)
      .map(({ feed, index }) => buildSourceResult(feed, index));

    return { scope, results };
  }

  const rankedFeeds = filteredFeeds
    .map((feed, index) => {
      const text = buildSourceSearchText(feed);
      const score = rankMatch(text, terms);
      return { feed, index, score };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 24);

  const candidateFeedIds = rankedFeeds
    .map(({ feed, index }) => feedIdentifier(feed, index))
    .filter(Boolean);

  if (candidateFeedIds.length === 0) {
    return { scope, results: [] };
  }

  const perFeedLimit = 4;
  const aggregate = await loadAggregatedFeedPostsByIds(
    candidateFeedIds,
    candidateFeedIds.length * perFeedLimit,
    perFeedLimit,
  );

  const results = aggregate.posts
    .map((post) => {
      const articleText = [post.title, post.summary, post.feedTitle, ...(post.categories || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const score = rankMatch(articleText, terms) + rankMatch(normalizeText(post.title), terms) * 2;
      return { post, score, articleText };
    })
    .filter(({ score, articleText }) => score > 0 || includesAllTerms(articleText, terms))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftTs = left.post.publishedAt ? Date.parse(left.post.publishedAt) : 0;
      const rightTs = right.post.publishedAt ? Date.parse(right.post.publishedAt) : 0;
      return rightTs - leftTs;
    })
    .slice(0, limit)
    .map(({ post }) => ({
      id: `${post.feedId}:${post.id}`,
      kind: "article" as const,
      title: post.title,
      description: post.summary || `Recent item from ${post.feedTitle}`,
      url: post.link,
      external_url: post.sourceUrl,
      topics: [...post.categories],
      source_type: "article",
      verified: true,
      is_active: true,
      published_at: post.publishedAt,
      feed_id: post.feedId,
      feed_title: post.feedTitle,
    }));

  return { scope, results };
}
