import { XMLParser } from "fast-xml-parser";

import { loadFeeds, type FeedSource } from "@/lib/feeds";

export type {
  FeedPost,
  FeedPostsResponse,
  AggregateFeedPost,
  AggregateFeedPostsResponse,
} from "@/lib/feed-posts-types";

interface LoadFeedOptions {
  discoveryMode?: "full" | "fast";
}

interface AggregateLoadOptions {
  forceRefresh?: boolean;
}

const AGGREGATE_CACHE_TTL_MS = 10 * 60 * 1000;
const aggregateFeedCache = new Map<
  string,
  { expiresAt: number; payload: AggregateFeedPostsResponse }
>();
const aggregateFeedInflight = new Map<string, Promise<AggregateFeedPostsResponse>>();

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

export async function loadFeedPostsById(feedId: string, limit = 6): Promise<FeedPostsResponse> {
  const feedsData = await loadFeeds();
  const feed = resolveFeedSource(feedsData.sources, feedId);

  if (!feed) {
    throw new Error("Feed not found");
  }

  return loadFeedPostsForSource(feed, feedId, limit, { discoveryMode: "full" });
}

export async function loadAggregatedFeedPostsByIds(
  feedIds: string[],
  totalLimit = 24,
  perFeedLimit = 2,
  options: AggregateLoadOptions = {},
): Promise<AggregateFeedPostsResponse> {
  const feedsData = await loadFeeds();
  const uniqueFeedIds = Array.from(
    new Set(feedIds.map((feedId) => normalizeFeedLookupKey(feedId)).filter(Boolean)),
  );
  const cacheKey = createAggregateCacheKey(uniqueFeedIds, totalLimit, perFeedLimit);

  if (uniqueFeedIds.length === 0) {
    throw new Error("At least one feed is required");
  }

  if (!options.forceRefresh) {
    const cachedPayload = readAggregateCache(cacheKey);
    if (cachedPayload) {
      return cachedPayload;
    }
  }

  const inflightPayload = aggregateFeedInflight.get(cacheKey);
  if (inflightPayload) {
    return inflightPayload;
  }

  const resolvedFeeds = uniqueFeedIds
    .map((requestedId) => {
      const feed = resolveFeedSource(feedsData.sources, requestedId);

      if (!feed) {
        return null;
      }

      return { feed, requestedId };
    })
    .filter((value): value is { feed: FeedSource; requestedId: string } => value !== null);

  if (resolvedFeeds.length === 0) {
    throw new Error("No matching canonical feeds were found");
  }

  const aggregatePromise = buildAggregatedFeedPosts(resolvedFeeds, totalLimit, perFeedLimit)
    .then((payload) => {
      writeAggregateCache(cacheKey, payload);
      return payload;
    })
    .finally(() => {
      aggregateFeedInflight.delete(cacheKey);
    });

  aggregateFeedInflight.set(cacheKey, aggregatePromise);
  return aggregatePromise;
}

async function buildAggregatedFeedPosts(
  resolvedFeeds: Array<{ feed: FeedSource; requestedId: string }>,
  totalLimit: number,
  perFeedLimit: number,
): Promise<AggregateFeedPostsResponse> {
  const attempts = await mapWithConcurrency(resolvedFeeds, 20, async ({ feed, requestedId }) => {
    try {
      const payload = await loadFeedPostsForSource(feed, requestedId, perFeedLimit, {
        discoveryMode: "fast",
      });
      return { ok: true as const, payload };
    } catch (error) {
      return {
        ok: false as const,
        feedId: requestedId,
        message: error instanceof Error ? error.message : "Failed to load feed posts",
      };
    }
  });

  const feeds = attempts.filter((attempt) => attempt.ok).map((attempt) => attempt.payload);

  if (feeds.length === 0) {
    const firstFailure = attempts.find((attempt) => !attempt.ok);
    throw new Error(firstFailure?.message || "Failed to load any feeds");
  }

  const posts = feeds
    .flatMap((feed) =>
      feed.posts.map((post) => ({
        ...post,
        feedId: feed.feedId,
        feedTitle: feed.feedTitle,
        sourceUrl: feed.sourceUrl,
        resolvedFeedUrl: feed.resolvedFeedUrl,
      })),
    )
    .sort(compareAggregatedPosts)
    .slice(0, totalLimit);

  const fetchedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + AGGREGATE_CACHE_TTL_MS).toISOString();

  return {
    posts,
    feeds,
    fetchedAt,
    expiresAt,
    cacheState: "live",
    totalSources: resolvedFeeds.length,
    successfulSources: feeds.length,
    failedSources: resolvedFeeds.length - feeds.length,
  };
}

async function loadFeedPostsForSource(
  feed: FeedSource,
  requestedFeedId: string,
  limit: number,
  options: LoadFeedOptions = {},
): Promise<FeedPostsResponse> {
  const resolvedFeedUrl = await resolveFeedUrl(feed, options);
  const xmlContent = await fetchFeedXml(
    resolvedFeedUrl,
    options.discoveryMode === "fast" ? 2500 : 8000,
  );
  const posts = parseFeedXml(xmlContent, limit);

  return {
    feedId: requestedFeedId,
    feedTitle: feed.title,
    sourceUrl: feed.url,
    resolvedFeedUrl,
    posts,
    fetchedAt: new Date().toISOString(),
  };
}

function normalizeFeedLookupKey(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function resolveFeedSource(feeds: FeedSource[], feedId: string): FeedSource | null {
  const lookupKey = normalizeFeedLookupKey(feedId);

  return (
    feeds.find((source) => {
      if (source.id === feedId) {
        return true;
      }

      return normalizeFeedLookupKey(source.title) === lookupKey;
    }) || null
  );
}

async function resolveFeedUrl(feed: FeedSource, options: LoadFeedOptions = {}): Promise<string> {
  const candidateUrl = feed.url;

  if (looksLikeXmlFeedUrl(candidateUrl)) {
    return candidateUrl;
  }

  if (isGitHubRepositoryUrl(candidateUrl)) {
    return `${candidateUrl.replace(/\/$/, "")}/releases.atom`;
  }

  if (isRedditSubredditUrl(candidateUrl)) {
    return `${candidateUrl.replace(/\/$/, "")}/.rss`;
  }

  const response = await fetchWithTimeout(
    candidateUrl,
    {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.8,*/*;q=0.7",
        "User-Agent": "ai-web-feeds/0.1.0 (+https://github.com/wyattowalsh/ai-web-feeds)",
      },
      next: { revalidate: 1800 },
    },
    options.discoveryMode === "fast" ? 2500 : 8000,
  );

  if (!response.ok) {
    throw new Error(`Failed to load feed source (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();

  if (contentType.includes("xml") || looksLikeXmlDocument(body)) {
    return candidateUrl;
  }

  const discoveredFeedUrl = discoverFeedUrlFromHtml(body, candidateUrl);
  if (discoveredFeedUrl) {
    return discoveredFeedUrl;
  }

  if (options.discoveryMode !== "fast") {
    const probedFeedUrl = await probeCommonFeedPaths(candidateUrl);
    if (probedFeedUrl) {
      return probedFeedUrl;
    }
  }

  throw new Error("Could not discover a feed URL for this source");
}

async function fetchFeedXml(feedUrl: string, timeoutMs = 8000): Promise<string> {
  const response = await fetchWithTimeout(
    feedUrl,
    {
      headers: {
        Accept: "application/atom+xml,application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.5",
        "User-Agent": "ai-web-feeds/0.1.0 (+https://github.com/wyattowalsh/ai-web-feeds)",
      },
      next: { revalidate: 1800 },
    },
    timeoutMs,
  );

  if (!response.ok) {
    throw new Error(`Failed to load feed (${response.status})`);
  }

  const xmlContent = await response.text();
  if (!looksLikeXmlDocument(xmlContent)) {
    throw new Error("Resolved URL did not return an RSS or Atom feed");
  }

  return xmlContent;
}

function parseFeedXml(xmlContent: string, limit: number): FeedPost[] {
  const parsed = xmlParser.parse(xmlContent);

  if (parsed?.rss?.channel) {
    return normalizeRssItems(parsed.rss.channel.item, limit);
  }

  if (parsed?.feed) {
    return normalizeAtomEntries(parsed.feed.entry, limit);
  }

  if (parsed?.RDF?.item) {
    return normalizeRssItems(parsed.RDF.item, limit);
  }

  throw new Error("Unsupported feed format");
}

function normalizeRssItems(items: unknown, limit: number): FeedPost[] {
  return toArray<Record<string, unknown>>(items)
    .map((item, index) => {
      const title = readText(item.title) || `Untitled post ${index + 1}`;
      const link = readText(item.link) || readText(item.guid) || "";
      const summary = sanitizeSummary(
        readText(item["content:encoded"]) || readText(item.description) || readText(item.summary),
      );

      return {
        id: readText(item.guid) || link || `${title}-${index}`,
        title,
        link,
        publishedAt: readText(item.pubDate) || readText(item.published) || readText(item.updated),
        summary,
        author: readText(item.creator) || readText(item.author) || null,
        categories: toArray(item.category)
          .map((category) => readText(category))
          .filter(Boolean) as string[],
      };
    })
    .filter((item) => item.link.length > 0)
    .slice(0, limit);
}

function normalizeAtomEntries(entries: unknown, limit: number): FeedPost[] {
  return toArray<Record<string, unknown>>(entries)
    .map((entry, index) => {
      const title = readText(entry.title) || `Untitled post ${index + 1}`;
      const link = readAtomLink(entry.link);
      const summary = sanitizeSummary(
        readText(entry.summary) || readText(entry.content) || readText(entry.description),
      );

      return {
        id: readText(entry.id) || link || `${title}-${index}`,
        title,
        link,
        publishedAt: readText(entry.published) || readText(entry.updated) || null,
        summary,
        author: readAtomAuthor(entry.author),
        categories: toArray(entry.category)
          .map((category) => {
            if (typeof category === "string") return category;
            if (category && typeof category === "object" && "@_term" in category) {
              const term = category["@_term"];
              return typeof term === "string" ? term : "";
            }
            return "";
          })
          .filter(Boolean),
      };
    })
    .filter((item) => item.link.length > 0)
    .slice(0, limit);
}

function readAtomLink(value: unknown): string {
  const links = toArray<Record<string, unknown>>(value);
  const alternate = links.find((link) => {
    const rel = typeof link?.["@_rel"] === "string" ? link["@_rel"] : "alternate";
    return rel === "alternate" || rel.length === 0;
  });

  if (alternate && typeof alternate["@_href"] === "string") {
    return alternate["@_href"];
  }

  return "";
}

function readAtomAuthor(value: unknown): string | null {
  const authors = toArray<Record<string, unknown>>(value);
  const primary = authors[0];
  if (!primary) return null;
  return readText(primary.name) || readText(primary.email) || null;
}

function readText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);

  if (value && typeof value === "object") {
    if ("#text" in value && typeof value["#text"] === "string") {
      return value["#text"].trim();
    }
    if ("__cdata" in value && typeof value["__cdata"] === "string") {
      return value["__cdata"].trim();
    }
  }

  return "";
}

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value === undefined || value === null) return [];
  return [value as T];
}

function sanitizeSummary(value: string): string | null {
  const stripped = value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped.length === 0) return null;
  return stripped.slice(0, 280);
}

function discoverFeedUrlFromHtml(html: string, sourceUrl: string): string | null {
  const matches = html.matchAll(
    /<link[^>]+rel=["'][^"']*alternate[^"']*["'][^>]+type=["'](?:application\/rss\+xml|application\/atom\+xml|application\/xml|text\/xml)["'][^>]+href=["']([^"']+)["'][^>]*>/gi,
  );

  for (const match of matches) {
    const href = match[1];
    if (!href) continue;
    return new URL(href, sourceUrl).toString();
  }

  return null;
}

async function probeCommonFeedPaths(sourceUrl: string): Promise<string | null> {
  const baseUrl = new URL(sourceUrl);
  const candidatePaths = [
    "/feed",
    "/feed/",
    "/rss",
    "/rss.xml",
    "/feed.xml",
    "/atom.xml",
    "/index.xml",
  ];

  for (const path of candidatePaths) {
    const candidateUrl = new URL(path, baseUrl).toString();

    try {
      const response = await fetchWithTimeout(candidateUrl, {
        headers: {
          Accept:
            "application/atom+xml,application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.5",
          "User-Agent": "ai-web-feeds/0.1.0 (+https://github.com/wyattowalsh/ai-web-feeds)",
        },
        next: { revalidate: 1800 },
      });

      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      const body = await response.text();

      if (contentType.includes("xml") || looksLikeXmlDocument(body)) {
        return candidateUrl;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function looksLikeXmlFeedUrl(url: string): boolean {
  return /(rss|atom|feed|\.xml)(\?|$)/i.test(url);
}

function isGitHubRepositoryUrl(url: string): boolean {
  return /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/i.test(url);
}

function isRedditSubredditUrl(url: string): boolean {
  return /^https:\/\/www\.reddit\.com\/r\/[^/]+\/?$/i.test(url);
}

function looksLikeXmlDocument(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.startsWith("<?xml") ||
    trimmed.startsWith("<rss") ||
    trimmed.startsWith("<feed") ||
    trimmed.startsWith("<rdf:RDF")
  );
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out while loading the source feed");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function compareAggregatedPosts(left: AggregateFeedPost, right: AggregateFeedPost): number {
  const leftTime = getPostTimestamp(left.publishedAt);
  const rightTime = getPostTimestamp(right.publishedAt);

  if (leftTime === null && rightTime === null) {
    return compareText(left.title, right.title);
  }

  if (leftTime === null) return 1;
  if (rightTime === null) return -1;

  if (leftTime === rightTime) {
    return compareText(left.title, right.title);
  }

  return rightTime - leftTime;
}

function getPostTimestamp(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function createAggregateCacheKey(
  feedIds: string[],
  totalLimit: number,
  perFeedLimit: number,
): string {
  return JSON.stringify({
    feedIds: [...feedIds].sort(),
    totalLimit,
    perFeedLimit,
  });
}

function readAggregateCache(cacheKey: string): AggregateFeedPostsResponse | null {
  const entry = aggregateFeedCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    aggregateFeedCache.delete(cacheKey);
    return null;
  }

  return {
    ...entry.payload,
    cacheState: "cached",
  };
}

function writeAggregateCache(cacheKey: string, payload: AggregateFeedPostsResponse): void {
  pruneAggregateCache();
  const expiresAt = new Date(payload.expiresAt).getTime();
  aggregateFeedCache.set(cacheKey, {
    expiresAt: Number.isNaN(expiresAt) ? Date.now() + AGGREGATE_CACHE_TTL_MS : expiresAt,
    payload,
  });
}

function pruneAggregateCache(): void {
  const now = Date.now();

  for (const [cacheKey, entry] of aggregateFeedCache.entries()) {
    if (entry.expiresAt <= now) {
      aggregateFeedCache.delete(cacheKey);
    }
  }
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let index = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const currentIndex = index;
        index += 1;
        results[currentIndex] = await mapper(items[currentIndex]);
      }
    }),
  );

  return results;
}
