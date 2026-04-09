/**
 * Reader Data Platform — service layer
 *
 * Provides normalized data access for the reader and downloads/blog lanes:
 * - Normalizes FeedPost / AggregateFeedPost → NormalizedArticle
 * - Fetches merged timelines from /api/feeds/posts/aggregate
 * - Looks up follow/subscription state via /api/follows
 *
 * All operations are compatible with anonymous/device-local identity.
 * No user accounts are required or created.
 */

import type { AggregateFeedPost, AggregateFeedPostsResponse } from "@/lib/feed-posts";
import { fetchWithAnonymousIdentity } from "@/lib/user-identity";
import type {
  FollowsResult,
  NormalizedArticle,
  SubscriptionEntry,
  TimelineFetchOptions,
  TimelineResult,
} from "@/lib/reader-types";
import { DEFAULT_LOCAL_STATE } from "@/lib/reader-types";

// ─── Normalization (pure, testable) ─────────────────────────────────────────

/**
 * Normalize a single AggregateFeedPost into a NormalizedArticle.
 * All local-state fields default to false; enrich them by calling
 * `enrichArticlesWithLocalState` from reader-local-state.
 */
export function normalizeAggregateFeedPost(post: AggregateFeedPost): NormalizedArticle {
  const rawMs = post.publishedAt ? new Date(post.publishedAt).getTime() : NaN;
  const publishedAtMs = Number.isNaN(rawMs) ? null : rawMs;

  return {
    id: post.id,
    feedId: post.feedId,
    feedTitle: post.feedTitle,
    sourceUrl: post.sourceUrl,
    title: post.title,
    link: post.link,
    summary: post.summary,
    author: post.author,
    categories: [...post.categories],
    publishedAt: post.publishedAt,
    publishedAtMs,
    ...DEFAULT_LOCAL_STATE,
  };
}

/**
 * Normalize a full aggregate API response into a TimelineResult.
 */
export function normalizeAggregateResponse(response: AggregateFeedPostsResponse): TimelineResult {
  return {
    articles: sortTimelineArticles(response.posts.map(normalizeAggregateFeedPost)),
    fetchedAt: response.fetchedAt,
    expiresAt: response.expiresAt,
    cacheState: response.cacheState,
    totalSources: response.totalSources,
    successfulSources: response.successfulSources,
    failedSources: response.failedSources,
  };
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

export function compareTimelineArticles(left: NormalizedArticle, right: NormalizedArticle): number {
  if (left.publishedAtMs === null && right.publishedAtMs === null) {
    return (
      compareText(left.feedTitle, right.feedTitle) ||
      compareText(left.title, right.title) ||
      compareText(left.id, right.id)
    );
  }

  if (left.publishedAtMs === null) return 1;
  if (right.publishedAtMs === null) return -1;

  if (left.publishedAtMs === right.publishedAtMs) {
    return (
      compareText(left.feedTitle, right.feedTitle) ||
      compareText(left.title, right.title) ||
      compareText(left.id, right.id)
    );
  }

  return right.publishedAtMs - left.publishedAtMs;
}

export function sortTimelineArticles(articles: NormalizedArticle[]): NormalizedArticle[] {
  return [...articles].sort(compareTimelineArticles);
}

// ─── API fetchers (browser-side) ─────────────────────────────────────────────

/**
 * Fetch a merged timeline from the aggregate posts endpoint.
 *
 * Returns NormalizedArticles with all local-state fields defaulting to false.
 * Call `enrichArticlesWithLocalState` (reader-local-state.ts) to layer in
 * device-local read / star / archive / bookmark state.
 */
export async function fetchTimeline(options: TimelineFetchOptions): Promise<TimelineResult> {
  const { feedIds, limit = 24, perFeedLimit = 2, forceRefresh = false } = options;

  const response = await fetch("/api/feeds/posts/aggregate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedIds, limit, perFeedLimit, refresh: forceRefresh }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error ?? `Timeline fetch failed (${response.status})`);
  }

  const data = (await response.json()) as AggregateFeedPostsResponse;
  return normalizeAggregateResponse(data);
}

/**
 * Fetch feed subscriptions for the current anonymous device binding.
 * Returns an empty array on network failure or non-2xx response.
 */
type FollowsPayload = {
  user_id?: unknown;
  follows?: unknown;
};

function parseSubscriptionEntries(payload: unknown): SubscriptionEntry[] {
  const structuredPayload = payload as { follows?: unknown };
  const rawEntries = Array.isArray(structuredPayload?.follows) ? structuredPayload.follows : [];

  return rawEntries
    .map((item: unknown): SubscriptionEntry => {
      const entry = item as Record<string, unknown>;
      return {
        feedId: typeof entry.feed_id === "string" ? entry.feed_id : "",
        followedAt: typeof entry.followed_at === "string" ? entry.followed_at : null,
      };
    })
    .filter((entry) => entry.feedId.length > 0);
}

export async function fetchFollows(userId?: string | null): Promise<SubscriptionEntry[]> {
  return (await fetchFollowsResult(userId)).follows;
}

export async function fetchFollowsResult(userId?: string | null): Promise<FollowsResult> {
  const params = new URLSearchParams();
  if (userId) {
    params.set("user_id", userId);
  }

  let response: Response;
  try {
    response = await fetchWithAnonymousIdentity(
      `/api/follows${params.size > 0 ? `?${params.toString()}` : ""}`,
    );
  } catch {
    return { userId: userId ?? "", follows: [] };
  }

  if (!response.ok) {
    return { userId: userId ?? "", follows: [] };
  }

  const payload = (await response.json().catch(() => ({}))) as FollowsPayload;
  return {
    userId: typeof payload.user_id === "string" ? payload.user_id : userId ?? "",
    follows: parseSubscriptionEntries(payload),
  };
}

/**
 * Return the set of feedIds the user is currently following.
 */
export function getFollowedFeedIds(follows: SubscriptionEntry[]): Set<string> {
  return new Set(follows.map((f) => f.feedId));
}

/**
 * Filter a list of NormalizedArticles to only those from followed feeds.
 */
export function filterToFollowedFeeds(
  articles: NormalizedArticle[],
  follows: SubscriptionEntry[],
): NormalizedArticle[] {
  const followedIds = getFollowedFeedIds(follows);
  return articles.filter((a) => followedIds.has(a.feedId));
}
