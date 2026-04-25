import "server-only";

import { loadAggregatedFeedPostsByIds, type AggregateFeedPost } from "@/lib/feed-posts";
import { loadFeedCatalog, type FeedSource } from "@/lib/feeds";

type DateRange = "7d" | "30d" | "90d";
type Granularity = "daily" | "weekly" | "monthly";

export interface AnalyticsSourceSummary {
  feed_id: string;
  title: string;
  source_url: string;
  latest_post_at: string | null;
  recent_post_count: number;
}

export interface AnalyticsSourceTypeDistributionEntry {
  source_type: string;
  count: number;
}

export interface AnalyticsScanSummary {
  matching_sources: number;
  scanned_sources: number;
  scan_limit: number;
  per_source_limit: number;
  truncated: boolean;
}

export interface AnalyticsSummaryPayload {
  total_sources: number;
  active_sources: number;
  posts_last_24h: number;
  posts_last_7d: number;
  topic_count: number;
  topic_distribution: Array<{ topic: string; count: number }>;
  source_type_distribution: AnalyticsSourceTypeDistributionEntry[];
  scan_summary: AnalyticsScanSummary;
  freshest_sources: AnalyticsSourceSummary[];
  velocity_overview: {
    avg_posts_per_source: number;
    total_recent_posts: number;
    most_active_source: AnalyticsSourceSummary | null;
  };
  last_updated: string;
  date_range: DateRange;
  topic?: string;
}

export interface TrendingTopicPayload {
  topic: string;
  feed_count: number;
  recent_post_count: number;
  share: number;
}

export interface VelocityPayload {
  granularity: Granularity;
  data_points: Array<{ date: string; count: number }>;
  avg_posts_per_source: number;
  most_active_source: AnalyticsSourceSummary | null;
  least_active_source: AnalyticsSourceSummary | null;
  total_recent_posts: number;
  last_updated: string;
  date_range: DateRange;
  topic?: string;
}

export interface AnalyticsSnapshotPayload {
  summary: AnalyticsSummaryPayload;
  trending: TrendingTopicPayload[];
  velocity: VelocityPayload;
}

interface CachedSnapshotEntry {
  expiresAtMs: number;
  payload: AnalyticsSnapshotPayload;
}

const DEFAULT_DATE_RANGE: DateRange = "30d";
const ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000;
const ANALYTICS_FEED_SCAN_LIMIT = 32;
const analyticsCache = new Map<string, CachedSnapshotEntry>();

function normalizeDateRange(value: string | null): DateRange {
  if (value === "7d" || value === "90d") {
    return value;
  }

  return DEFAULT_DATE_RANGE;
}

function normalizeGranularity(value: string | null): Granularity {
  if (value === "weekly" || value === "monthly") {
    return value;
  }

  return "daily";
}

function toFeedId(feed: FeedSource, fallbackIndex: number): string {
  return feed.id || feed.title || feed.url || `feed-${fallbackIndex}`;
}

function isActiveFeed(feed: FeedSource): boolean {
  return feed.is_active !== false;
}

function normalizeTopicFilter(value: string | null): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

function normalizeTopicValue(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeSourceTypeValue(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : "unknown";
}

function matchesTopic(feed: FeedSource, topic?: string): boolean {
  if (!topic) {
    return true;
  }

  return (feed.topics || []).some((candidate) => normalizeTopicValue(candidate) === topic);
}

function getDateRangeDays(dateRange: DateRange): number {
  switch (dateRange) {
    case "7d":
      return 7;
    case "90d":
      return 90;
    default:
      return 30;
  }
}

function getPerFeedLimit(dateRange: DateRange): number {
  switch (dateRange) {
    case "7d":
      return 6;
    case "90d":
      return 3;
    default:
      return 4;
  }
}

function getPostTimestamp(post: AggregateFeedPost): number | null {
  if (!post.publishedAt) {
    return null;
  }

  const timestamp = Date.parse(post.publishedAt);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function buildSourceSummary(
  feedId: string,
  title: string,
  sourceUrl: string,
  posts: AggregateFeedPost[],
): AnalyticsSourceSummary {
  const latestPost = [...posts].sort(
    (left, right) => (getPostTimestamp(right) || 0) - (getPostTimestamp(left) || 0),
  )[0];

  return {
    feed_id: feedId,
    title,
    source_url: sourceUrl,
    latest_post_at: latestPost?.publishedAt ?? null,
    recent_post_count: posts.length,
  };
}

function getBucketKey(timestampMs: number, granularity: Granularity): string {
  const date = new Date(timestampMs);

  if (granularity === "monthly") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  if (granularity === "weekly") {
    const normalized = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const day = normalized.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    normalized.setUTCDate(normalized.getUTCDate() + diff);
    return normalized.toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

async function buildAnalyticsSnapshot(
  dateRange: DateRange,
  topic: string | undefined,
  granularity: Granularity,
): Promise<AnalyticsSnapshotPayload> {
  const catalog = loadFeedCatalog();
  const feeds = catalog.sources.filter((feed) => matchesTopic(feed, topic));
  const activeFeeds = feeds.filter(isActiveFeed);
  const feedsForLiveScan = [...activeFeeds]
    .sort((left, right) => {
      if ((left.verified === true) !== (right.verified === true)) {
        return left.verified === true ? -1 : 1;
      }

      return (left.title || left.url).localeCompare(right.title || right.url);
    })
    .slice(0, ANALYTICS_FEED_SCAN_LIMIT);
  const feedIds = feedsForLiveScan.map((feed, index) => toFeedId(feed, index));
  const liveScanFeedLookup = new Map(
    feedIds.map((feedId, index) => [feedId, feedsForLiveScan[index] as FeedSource]),
  );
  const perFeedLimit = getPerFeedLimit(dateRange);
  const totalLimit = Math.max(feedIds.length * perFeedLimit, 1);

  const aggregate =
    feedIds.length > 0
      ? await loadAggregatedFeedPostsByIds(feedIds, totalLimit, perFeedLimit)
      : {
          posts: [],
          feeds: [],
          fetchedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + ANALYTICS_CACHE_TTL_MS).toISOString(),
          cacheState: "live" as const,
          totalSources: 0,
          successfulSources: 0,
          failedSources: 0,
        };

  const nowMs = Date.now();
  const oneDayAgoMs = nowMs - 24 * 60 * 60 * 1000;
  const sevenDaysAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
  const windowStartMs = nowMs - getDateRangeDays(dateRange) * 24 * 60 * 60 * 1000;

  const topicDistributionMap = new Map<string, number>();
  const sourceTypeDistributionMap = new Map<string, number>();
  for (const feed of feeds) {
    const normalizedSourceType = normalizeSourceTypeValue(feed.source_type);
    sourceTypeDistributionMap.set(
      normalizedSourceType,
      (sourceTypeDistributionMap.get(normalizedSourceType) ?? 0) + 1,
    );

    for (const value of feed.topics || []) {
      const normalized = normalizeTopicValue(value);
      if (!normalized) {
        continue;
      }
      topicDistributionMap.set(normalized, (topicDistributionMap.get(normalized) ?? 0) + 1);
    }
  }

  const sourcePosts = new Map<string, AggregateFeedPost[]>();
  const recentSourcePosts = new Map<string, AggregateFeedPost[]>();
  const trendingTopicsMap = new Map<string, { feedIds: Set<string>; recent_post_count: number }>();
  const velocityMap = new Map<string, number>();

  let postsLast24h = 0;
  let postsLast7d = 0;
  let totalRecentPosts = 0;

  for (const post of aggregate.posts) {
    const timestampMs = getPostTimestamp(post);
    const sourceCollection = sourcePosts.get(post.feedId) ?? [];
    sourceCollection.push(post);
    sourcePosts.set(post.feedId, sourceCollection);

    if (timestampMs === null) {
      continue;
    }

    if (timestampMs >= oneDayAgoMs) {
      postsLast24h += 1;
    }

    if (timestampMs >= sevenDaysAgoMs) {
      postsLast7d += 1;
    }

    if (timestampMs < windowStartMs) {
      continue;
    }

    totalRecentPosts += 1;
    const recentCollection = recentSourcePosts.get(post.feedId) ?? [];
    recentCollection.push(post);
    recentSourcePosts.set(post.feedId, recentCollection);

    const bucketKey = getBucketKey(timestampMs, granularity);
    velocityMap.set(bucketKey, (velocityMap.get(bucketKey) ?? 0) + 1);

    const matchingFeed = liveScanFeedLookup.get(post.feedId);
    for (const value of matchingFeed?.topics || []) {
      const normalized = normalizeTopicValue(value);
      if (!normalized) {
        continue;
      }

      const topicEntry = trendingTopicsMap.get(normalized) ?? {
        feedIds: new Set<string>(),
        recent_post_count: 0,
      };
      topicEntry.feedIds.add(post.feedId);
      topicEntry.recent_post_count += 1;
      trendingTopicsMap.set(normalized, topicEntry);
    }
  }

  const freshestSources = Array.from(sourcePosts.entries())
    .map(([feedId, posts]) => {
      const samplePost = posts[0];
      return buildSourceSummary(feedId, samplePost.feedTitle, samplePost.sourceUrl, posts);
    })
    .sort(
      (left, right) =>
        Date.parse(right.latest_post_at || "1970-01-01T00:00:00.000Z") -
        Date.parse(left.latest_post_at || "1970-01-01T00:00:00.000Z"),
    )
    .slice(0, 5);

  const recentSourceSummaries = Array.from(recentSourcePosts.entries())
    .map(([feedId, posts]) => {
      const samplePost = posts[0];
      return buildSourceSummary(feedId, samplePost.feedTitle, samplePost.sourceUrl, posts);
    })
    .sort((left, right) => right.recent_post_count - left.recent_post_count);

  const mostActiveSource = recentSourceSummaries[0] ?? null;
  const leastActiveSource = recentSourceSummaries[recentSourceSummaries.length - 1] ?? null;

  const topicDistribution = Array.from(topicDistributionMap.entries())
    .map(([topicId, count]) => ({ topic: topicId, count }))
    .sort((left, right) => right.count - left.count || left.topic.localeCompare(right.topic))
    .slice(0, 6);

  const sourceTypeDistribution = Array.from(sourceTypeDistributionMap.entries())
    .map(([sourceType, count]) => ({ source_type: sourceType, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.source_type.localeCompare(right.source_type),
    );

  const scanSummary: AnalyticsScanSummary = {
    matching_sources: activeFeeds.length,
    scanned_sources: feedsForLiveScan.length,
    scan_limit: ANALYTICS_FEED_SCAN_LIMIT,
    per_source_limit: perFeedLimit,
    truncated: activeFeeds.length > feedsForLiveScan.length,
  };

  const trending = Array.from(trendingTopicsMap.entries())
    .map(([topicId, value]) => ({
      topic: topicId,
      feed_count: value.feedIds.size,
      recent_post_count: value.recent_post_count,
      share: totalRecentPosts > 0 ? value.recent_post_count / totalRecentPosts : 0,
    }))
    .sort(
      (left, right) =>
        right.recent_post_count - left.recent_post_count || right.feed_count - left.feed_count,
    )
    .slice(0, 10);

  const velocity = Array.from(velocityMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, count]) => ({ date, count }));

  const summary: AnalyticsSummaryPayload = {
    total_sources: feeds.length,
    active_sources: activeFeeds.length,
    posts_last_24h: postsLast24h,
    posts_last_7d: postsLast7d,
    topic_count: topicDistributionMap.size,
    topic_distribution: topicDistribution,
    source_type_distribution: sourceTypeDistribution,
    scan_summary: scanSummary,
    freshest_sources: freshestSources,
    velocity_overview: {
      avg_posts_per_source:
        feedsForLiveScan.length > 0 ? totalRecentPosts / feedsForLiveScan.length : 0,
      total_recent_posts: totalRecentPosts,
      most_active_source: mostActiveSource,
    },
    last_updated: aggregate.fetchedAt,
    date_range: dateRange,
    ...(topic ? { topic } : {}),
  };

  return {
    summary,
    trending,
    velocity: {
      granularity,
      data_points: velocity,
      avg_posts_per_source: summary.velocity_overview.avg_posts_per_source,
      most_active_source: mostActiveSource,
      least_active_source: leastActiveSource,
      total_recent_posts: totalRecentPosts,
      last_updated: aggregate.fetchedAt,
      date_range: dateRange,
      ...(topic ? { topic } : {}),
    },
  };
}

function getCacheKey(
  dateRange: DateRange,
  topic: string | undefined,
  granularity: Granularity,
): string {
  return JSON.stringify({ dateRange, topic: topic ?? null, granularity });
}

async function readCachedSnapshot(
  dateRange: DateRange,
  topic: string | undefined,
  granularity: Granularity,
): Promise<AnalyticsSnapshotPayload> {
  const key = getCacheKey(dateRange, topic, granularity);
  const cached = analyticsCache.get(key);
  if (cached && cached.expiresAtMs > Date.now()) {
    return cached.payload;
  }

  const payload = await buildAnalyticsSnapshot(dateRange, topic, granularity);
  analyticsCache.set(key, {
    expiresAtMs: Date.now() + ANALYTICS_CACHE_TTL_MS,
    payload,
  });
  return payload;
}

export async function getAnalyticsSummary(
  dateRangeInput: string | null,
  topicInput: string | null,
): Promise<AnalyticsSummaryPayload> {
  const dateRange = normalizeDateRange(dateRangeInput);
  const topic = normalizeTopicFilter(topicInput);
  const snapshot = await readCachedSnapshot(dateRange, topic, "daily");
  return snapshot.summary;
}

export async function getTrendingTopics(
  dateRangeInput: string | null,
  topicInput: string | null,
  limitInput?: number,
): Promise<TrendingTopicPayload[]> {
  const dateRange = normalizeDateRange(dateRangeInput);
  const topic = normalizeTopicFilter(topicInput);
  const snapshot = await readCachedSnapshot(dateRange, topic, "daily");
  const limit =
    typeof limitInput === "number" && Number.isFinite(limitInput)
      ? Math.max(1, Math.trunc(limitInput))
      : 10;
  return snapshot.trending.slice(0, limit);
}

export async function getVelocitySnapshot(
  dateRangeInput: string | null,
  topicInput: string | null,
  granularityInput: string | null,
): Promise<VelocityPayload> {
  const dateRange = normalizeDateRange(dateRangeInput);
  const topic = normalizeTopicFilter(topicInput);
  const granularity = normalizeGranularity(granularityInput);
  const snapshot = await readCachedSnapshot(dateRange, topic, granularity);
  return snapshot.velocity;
}

export async function getAnalyticsSnapshot(
  dateRangeInput: string | null,
  topicInput: string | null,
  granularityInput: string | null,
): Promise<AnalyticsSnapshotPayload> {
  const dateRange = normalizeDateRange(dateRangeInput);
  const topic = normalizeTopicFilter(topicInput);
  const granularity = normalizeGranularity(granularityInput);
  return readCachedSnapshot(dateRange, topic, granularity);
}
