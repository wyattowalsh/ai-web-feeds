import "server-only";

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { loadFeedCatalog, type FeedSource } from "@/lib/feeds";

export type ArticleCorpusArticle = {
  id: string;
  feed_id: string;
  feed_title: string;
  title: string;
  link: string;
  summary: string | null;
  content_html: string | null;
  author: string | null;
  published_at: string | null;
  categories: string[];
  topics: string[];
  source_type: string;
  verified: boolean;
  is_active: boolean;
};

export type ArticleCorpusMetadata = {
  generated_at: string | null;
  source_db: string;
  article_count: number;
  feed_count: number;
  latest_published_at: string | null;
  is_empty: boolean;
};

export type ArticleCorpus = {
  metadata: ArticleCorpusMetadata;
  articles: ArticleCorpusArticle[];
};

export type ArticleSearchFilters = {
  feedIds?: string[];
  sourceType?: string;
  topics?: string[];
  verified?: boolean;
};

export type ArticleBrowseSort = "latest" | "oldest" | "source";

export type ArticleBrowseOptions = ArticleSearchFilters & {
  q?: string | null;
  sort?: ArticleBrowseSort;
  cursor?: number;
  limit?: number;
};

export type ArticleBrowseResponse = {
  items: ArticleCorpusArticle[];
  next_cursor: number | null;
  total_matched: number;
  cursor: number;
  limit: number;
  applied_query: string | null;
  applied_sort: ArticleBrowseSort;
  filters: ArticleSearchFilters;
  corpus: ArticleCorpusMetadata;
};

export type ArticleSearchResult = {
  kind: "article";
  id: string;
  title: string;
  description: string | null;
  url: string;
  topics: string[];
  source_type: string;
  verified: boolean;
  is_active: boolean;
  match_score: number;
  feed_id: string;
  feed_title: string;
  published_at: string | null;
};

export type SourceSearchResult = {
  kind: "source";
  id: string;
  title: string;
  description: string | null;
  url: string;
  topics: string[];
  source_type: string;
  verified: boolean;
  is_active: boolean;
  match_score: number;
};

export type SearchResponseMeta = {
  mode: "unbounded" | "bounded";
  bounded: boolean;
  candidate_sources: number;
  scanned_sources: number;
  scan_limit: number | null;
  per_source_limit: number | null;
  truncated: boolean;
};

export type SearchResponsePayload = {
  scope: "sources" | "articles";
  results: Array<SourceSearchResult | ArticleSearchResult>;
  meta: SearchResponseMeta;
};

export type AutocompleteSuggestion =
  | {
      type: "feed";
      id: string;
      title: string;
      url: string;
      source_type: string;
      verified: boolean;
      is_active: boolean;
      topics: string[];
      match_score: number;
    }
  | {
      type: "article";
      id: string;
      title: string;
      url: string;
      feed_id: string;
      feed_title: string;
      published_at: string | null;
      match_score: number;
    }
  | {
      type: "topic";
      label: string;
      feed_count: number;
      match_score: number;
    };

export type AutocompleteResponse = {
  feeds: Extract<AutocompleteSuggestion, { type: "feed" }>[];
  articles: Extract<AutocompleteSuggestion, { type: "article" }>[];
  topics: Extract<AutocompleteSuggestion, { type: "topic" }>[];
  corpus: ArticleCorpusMetadata;
  query: string;
  limit: number;
};

const ARTICLE_CORPUS_PATH = path.join(process.cwd(), "data", "articles.generated.json");
const CANONICAL_DATABASE_PATH = "data/ai-web-feeds.db";
const AUTOCOMPLETE_MIN_PREFIX_LENGTH = 2;
const DEFAULT_AUTOCOMPLETE_LIMIT = 8;
const DEFAULT_BROWSE_LIMIT = 24;
const MAX_BROWSE_LIMIT = 100;
const MAX_AUTOCOMPLETE_LIMIT = 10;

type ArticleCorpusCacheEntry = {
  mtimeMs: number;
  payload: ArticleCorpus;
};

let cachedArticleCorpus: ArticleCorpusCacheEntry | null = null;
let inflightArticleCorpus: Promise<ArticleCorpus> | null = null;

export async function loadArticleCorpus(options: { refresh?: boolean } = {}): Promise<ArticleCorpus> {
  const fileInfo = await stat(ARTICLE_CORPUS_PATH).catch(() => null);
  if (!fileInfo) {
    return createEmptyCorpus();
  }

  if (!options.refresh && cachedArticleCorpus?.mtimeMs === fileInfo.mtimeMs) {
    return cachedArticleCorpus.payload;
  }

  if (!options.refresh && inflightArticleCorpus) {
    return inflightArticleCorpus;
  }

  const loader = (async () => {
    const raw = await readFile(ARTICLE_CORPUS_PATH, "utf8").catch(() => "");
    if (!raw.trim()) {
      return createEmptyCorpus(fileInfo.mtimeMs);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return createEmptyCorpus(fileInfo.mtimeMs);
    }

    const payload = normalizeCorpusPayload(parsed, fileInfo.mtimeMs);
    cachedArticleCorpus = {
      mtimeMs: fileInfo.mtimeMs,
      payload,
    };
    return payload;
  })().finally(() => {
    inflightArticleCorpus = null;
  });

  inflightArticleCorpus = loader;
  return loader;
}

export async function browseArticleCorpus(
  options: ArticleBrowseOptions = {},
): Promise<ArticleBrowseResponse> {
  const corpus = await loadArticleCorpus();
  const normalizedQuery = normalizeSearchQuery(options.q);
  const filters = normalizeArticleFilters(options);
  const limit = clampNumber(options.limit ?? DEFAULT_BROWSE_LIMIT, 1, MAX_BROWSE_LIMIT);
  const cursor = clampNumber(options.cursor ?? 0, 0, Number.MAX_SAFE_INTEGER);
  const sort = options.sort ?? "latest";
  const feeds = loadFeedCatalog().sources;
  const feedLookup = buildFeedLookup(feeds);
  const filtered = corpus.articles.filter((article) =>
    matchesArticle(article, feedLookup.get(article.feed_id), filters, normalizedQuery),
  );
  const sorted = sortArticleCorpus(filtered, sort, feedLookup);
  const paginated = sorted.slice(cursor, cursor + limit);

  return {
    items: paginated,
    next_cursor: cursor + limit < sorted.length ? cursor + limit : null,
    total_matched: sorted.length,
    cursor,
    limit,
    applied_query: normalizedQuery,
    applied_sort: sort,
    filters,
    corpus: corpus.metadata,
  };
}

export async function searchArticlesInCorpus(
  options: ArticleBrowseOptions = {},
): Promise<SearchResponsePayload> {
  const corpus = await loadArticleCorpus();
  const normalizedQuery = normalizeSearchQuery(options.q);
  const filters = normalizeArticleFilters(options);
  const limit = clampNumber(options.limit ?? DEFAULT_BROWSE_LIMIT, 1, MAX_BROWSE_LIMIT);
  const cursor = clampNumber(options.cursor ?? 0, 0, Number.MAX_SAFE_INTEGER);
  const feeds = loadFeedCatalog().sources;
  const feedLookup = buildFeedLookup(feeds);

  const ranked = corpus.articles
    .filter((article) => matchesArticle(article, feedLookup.get(article.feed_id), filters))
    .map((article) => {
      const feed = feedLookup.get(article.feed_id);
      const matchScore = scoreArticle(article, feed, normalizedQuery);

      return {
        kind: "article" as const,
        id: `${article.feed_id}:${article.id}`,
        title: article.title,
        description: article.summary || `From ${article.feed_title}`,
        url: article.link,
        topics: article.topics.length > 0 ? article.topics : article.categories,
        source_type: article.source_type,
        verified: article.verified,
        is_active: article.is_active,
        match_score: matchScore,
        feed_id: article.feed_id,
        feed_title: article.feed_title,
        published_at: article.published_at,
      };
    })
    .filter((result) => (normalizedQuery ? result.match_score > 0 : true))
    .sort((left, right) => compareSearchResults(left, right));

  return {
    scope: "articles",
    results: ranked.slice(cursor, cursor + limit),
    meta: buildBoundedSearchMeta(ranked.length, corpus.metadata.is_empty ? 0 : feeds.length),
  };
}

export async function searchCatalogSources(
  options: {
    query: string;
    limit: number;
    feedIds?: string[];
    sourceType?: string;
    topics?: string[];
    verified?: boolean;
  },
): Promise<SearchResponsePayload> {
  const feeds = loadFeedCatalog().sources;
  const filteredFeeds = filterFeeds(feeds, options);
  const query = normalizeSearchQuery(options.query);

  const results = filteredFeeds
    .map((feed) => {
      const feedTopics = normalizeStringList([...(feed.topics ?? []), ...(feed.tags ?? [])]);
      const matchScore =
        scoreText(query, feed.title, 10) +
        scoreText(query, feed.description, 4) +
        scoreText(query, feed.url, 2) +
        scoreList(query, feedTopics, 5) +
        scoreList(query, normalizeStringList(feed.tags ?? []), 3) +
        scoreText(query, feed.source_type, 2) +
        (feed.verified ? 0.5 : 0) +
        (feed.is_active !== false ? 0.25 : 0);

      return {
        kind: "source" as const,
        id: getFeedIdentifier(feed),
        title: feed.title?.trim() || feed.url,
        description: feed.description || null,
        url: feed.site || feed.website_url || feed.url,
        topics: feedTopics,
        source_type: feed.source_type || "feed",
        verified: feed.verified === true,
        is_active: feed.is_active !== false,
        match_score: matchScore,
      };
    })
    .filter((result) => result.match_score > 0)
    .sort(compareSearchResults)
    .slice(0, options.limit);

  return {
    scope: "sources",
    results,
    meta: buildUnboundedSearchMeta(filteredFeeds.length),
  };
}

export async function buildAutocompleteSuggestions(
  prefix: string,
  limit = DEFAULT_AUTOCOMPLETE_LIMIT,
): Promise<AutocompleteResponse> {
  const normalizedPrefix = normalizeSearchQuery(prefix)?.toLowerCase() ?? "";
  const cappedLimit = clampNumber(limit, 1, MAX_AUTOCOMPLETE_LIMIT);

  if (normalizedPrefix.length < AUTOCOMPLETE_MIN_PREFIX_LENGTH) {
    return {
      feeds: [],
      articles: [],
      topics: [],
      corpus: (await loadArticleCorpus()).metadata,
      query: normalizedPrefix,
      limit: cappedLimit,
    };
  }

  const corpus = await loadArticleCorpus();
  const feeds = loadFeedCatalog().sources;
  const feedSuggestions = feeds
    .map((feed) => {
      const feedTopics = normalizeStringList([...(feed.topics ?? []), ...(feed.tags ?? [])]);
      const matchScore =
        scoreText(normalizedPrefix, feed.title, 10) +
        scoreText(normalizedPrefix, feed.description, 4) +
        scoreText(normalizedPrefix, feed.url, 2) +
        scoreList(normalizedPrefix, feedTopics, 4) +
        scoreText(normalizedPrefix, feed.source_type, 2);

      return {
        type: "feed" as const,
        id: getFeedIdentifier(feed),
        title: feed.title?.trim() || feed.url,
        url: feed.site || feed.website_url || feed.url,
        source_type: feed.source_type || "feed",
        verified: feed.verified === true,
        is_active: feed.is_active !== false,
        topics: feedTopics,
        match_score: matchScore,
      };
    })
    .filter((feed) => feed.match_score > 0)
    .sort(compareAutocompleteSuggestions)
    .slice(0, Math.min(cappedLimit, 5));

  const articleSuggestions = corpus.articles
    .map((article) => {
      const matchScore =
        scoreText(normalizedPrefix, article.title, 10) +
        scoreText(normalizedPrefix, article.summary, 4) +
        scoreText(normalizedPrefix, article.feed_title, 4) +
        scoreText(normalizedPrefix, article.author, 2) +
        scoreList(normalizedPrefix, article.topics.length > 0 ? article.topics : article.categories, 4);

      return {
        type: "article" as const,
        id: `${article.feed_id}:${article.id}`,
        title: article.title,
        url: article.link,
        feed_id: article.feed_id,
        feed_title: article.feed_title,
        published_at: article.published_at,
        match_score: matchScore,
      };
    })
    .filter((article) => article.match_score > 0)
    .sort(compareAutocompleteSuggestions)
    .slice(0, Math.min(cappedLimit, 5));

  const topicSuggestions = buildTopicSuggestions(normalizedPrefix, feeds, corpus).slice(
    0,
    Math.min(cappedLimit, 5),
  );

  return {
    feeds: feedSuggestions,
    articles: articleSuggestions,
    topics: topicSuggestions,
    corpus: corpus.metadata,
    query: normalizedPrefix,
    limit: cappedLimit,
  };
}

function buildTopicSuggestions(
  prefix: string,
  feeds: FeedSource[],
  corpus: ArticleCorpus,
): Extract<AutocompleteSuggestion, { type: "topic" }>[] {
  const topicCounts = new Map<string, Set<string>>();

  for (const feed of feeds) {
    for (const topic of normalizeStringList([...(feed.topics ?? []), ...(feed.tags ?? [])])) {
      if (!topic.includes(prefix)) {
        continue;
      }

      if (!topicCounts.has(topic)) {
        topicCounts.set(topic, new Set());
      }

      topicCounts.get(topic)!.add(feed.id || feed.title || feed.url);
    }
  }

  for (const article of corpus.articles) {
    for (const topic of normalizeStringList(article.topics.length > 0 ? article.topics : article.categories)) {
      if (!topic.includes(prefix)) {
        continue;
      }

      if (!topicCounts.has(topic)) {
        topicCounts.set(topic, new Set());
      }

      topicCounts.get(topic)!.add(article.feed_id);
    }
  }

  return Array.from(topicCounts.entries())
    .map(([label, feedSet]) => ({
      type: "topic" as const,
      label,
      feed_count: feedSet.size,
      match_score: scoreText(prefix, label, 10) + feedSet.size,
    }))
    .sort(compareAutocompleteSuggestions);
}

function normalizeCorpusPayload(raw: unknown, fileMtimeMs: number): ArticleCorpus {
  const payload = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const metadata = extractCorpusMetadata(payload, fileMtimeMs);
  const sourceArticles = extractArticleRecords(payload);
  const articles = dedupeArticles(sourceArticles.map(normalizeCorpusArticle));
  const uniqueFeedIds = new Set(articles.map((article) => article.feed_id));
  const latestPublishedAt =
    metadata.latest_published_at ?? maxPublishedAt(articles.map((article) => article.published_at));

  return {
    metadata: {
      generated_at: metadata.generated_at,
      source_db: metadata.source_db,
      article_count: metadata.article_count ?? articles.length,
      feed_count: metadata.feed_count ?? uniqueFeedIds.size,
      latest_published_at: latestPublishedAt,
      is_empty: articles.length === 0,
    },
    articles,
  };
}

function extractCorpusMetadata(
  payload: Record<string, unknown>,
  fileMtimeMs: number,
): Partial<ArticleCorpusMetadata> {
  const meta =
    (payload.metadata && typeof payload.metadata === "object" ? payload.metadata : null) ??
    (payload.meta && typeof payload.meta === "object" ? payload.meta : null) ??
    {};
  const metaRecord = meta as Record<string, unknown>;

  return {
    generated_at: readString(metaRecord.generated_at ?? metaRecord.generatedAt) ?? timestampFromMtime(fileMtimeMs),
    source_db: readString(metaRecord.source_db ?? metaRecord.sourceDb) ?? CANONICAL_DATABASE_PATH,
    article_count: readNumber(metaRecord.article_count ?? metaRecord.articleCount),
    feed_count: readNumber(metaRecord.feed_count ?? metaRecord.feedCount),
    latest_published_at:
      readString(metaRecord.latest_published_at ?? metaRecord.latestPublishedAt) ?? null,
  };
}

function extractArticleRecords(payload: Record<string, unknown>): unknown[] {
  if (Array.isArray(payload.articles)) {
    return payload.articles;
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  if (Array.isArray(payload.records)) {
    return payload.records;
  }

  return [];
}

function normalizeCorpusArticle(record: unknown): ArticleCorpusArticle {
  const entry = record && typeof record === "object" ? (record as Record<string, unknown>) : {};
  const feedId = readString(entry.feed_id ?? entry.feedId) ?? "";
  const title = readString(entry.title) ?? "Untitled";
  const link = readString(entry.link) ?? "";
  const publishedAt = readString(entry.published_at ?? entry.publishedAt);

  return {
    id:
      readString(entry.id) ??
      readString(entry.guid) ??
      readString(entry.link) ??
      `${feedId || "feed"}:${title}`,
    feed_id: feedId,
    feed_title: readString(entry.feed_title ?? entry.feedTitle) ?? feedId,
    title,
    link,
    summary: readString(entry.summary) ?? null,
    content_html: readString(entry.content_html ?? entry.contentHtml) ?? null,
    author: readString(entry.author) ?? null,
    published_at: publishedAt ?? null,
    categories: normalizeStringList(readStringList(entry.categories)),
    topics: normalizeStringList(readStringList(entry.topics ?? entry.categories)),
    source_type: readString(entry.source_type ?? entry.sourceType) ?? "feed",
    verified: readBoolean(entry.verified),
    is_active: readBoolean(entry.is_active, true),
  };
}

function normalizeArticleFilters(options: ArticleBrowseOptions): ArticleSearchFilters {
  const feedIds = normalizeStringList(options.feedIds ?? []);
  const sourceType = normalizeText(options.sourceType);
  const topics = normalizeStringList(options.topics ?? []);

  return {
    feedIds: feedIds.length > 0 ? feedIds : undefined,
    sourceType: sourceType || undefined,
    topics: topics.length > 0 ? topics : undefined,
    verified: typeof options.verified === "boolean" ? options.verified : undefined,
  };
}

function matchesArticle(
  article: ArticleCorpusArticle,
  feed: FeedSource | undefined,
  filters: ArticleSearchFilters,
  query?: string | null,
): boolean {
  if (filters.feedIds && !filters.feedIds.includes(article.feed_id)) {
    return false;
  }

  const articleSourceType = normalizeText(article.source_type);
  const feedSourceType = normalizeText(feed?.source_type ?? undefined);
  if (filters.sourceType && filters.sourceType !== articleSourceType && filters.sourceType !== feedSourceType) {
    return false;
  }

  if (typeof filters.verified === "boolean") {
    const feedVerified = typeof feed?.verified === "boolean" ? feed.verified : article.verified;
    if (feedVerified !== filters.verified) {
      return false;
    }
  }

  if (filters.topics && filters.topics.length > 0) {
    const topicPool = new Set([
      ...normalizeStringList(article.topics),
      ...normalizeStringList(article.categories),
      ...normalizeStringList(feed?.topics ?? []),
      ...normalizeStringList(feed?.tags ?? []),
    ]);

    if (!filters.topics.some((topic) => topicPool.has(topic))) {
      return false;
    }
  }

  if (!query) {
    return true;
  }

  return scoreArticle(article, feed, query) > 0;
}

function scoreArticle(
  article: ArticleCorpusArticle,
  feed: FeedSource | undefined,
  query: string | null | undefined,
): number {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return 0;
  }

  const categories = article.topics.length > 0 ? article.topics : article.categories;
  return (
    scoreText(normalizedQuery, article.title, 10) +
    scoreText(normalizedQuery, article.summary, 5) +
    scoreText(normalizedQuery, article.content_html, 3) +
    scoreText(normalizedQuery, article.author, 2) +
    scoreText(normalizedQuery, article.feed_title, 4) +
    scoreText(normalizedQuery, feed?.title, 2) +
    scoreList(normalizedQuery, categories, 4)
  );
}

function filterFeeds(
  feeds: FeedSource[],
  options: {
    feedIds?: string[];
    sourceType?: string;
    topics?: string[];
    verified?: boolean;
    query: string;
  },
): FeedSource[] {
  const query = normalizeSearchQuery(options.query);
  const feedIds = normalizeStringList(options.feedIds ?? []);
  const topics = normalizeStringList(options.topics ?? []);

  return feeds.filter((feed) => {
    const identifier = getFeedIdentifier(feed);
    if (feedIds.length > 0 && !feedIds.includes(identifier)) {
      return false;
    }

    if (options.sourceType && normalizeText(feed.source_type) !== normalizeText(options.sourceType)) {
      return false;
    }

    if (typeof options.verified === "boolean" && feed.verified !== options.verified) {
      return false;
    }

    if (topics.length > 0) {
      const feedTopics = normalizeStringList([...(feed.topics ?? []), ...(feed.tags ?? [])]);
      if (!topics.some((topic) => feedTopics.includes(topic))) {
        return false;
      }
    }

    if (!query) {
      return true;
    }

    return scoreText(query, feed.title, 10) + scoreText(query, feed.description, 4) > 0;
  });
}

function sortArticleCorpus(
  articles: ArticleCorpusArticle[],
  sort: ArticleBrowseSort,
  feedLookup: Map<string, FeedSource>,
): ArticleCorpusArticle[] {
  return [...articles].sort((left, right) => {
    if (sort === "source") {
      const leftFeed = feedLookup.get(left.feed_id);
      const rightFeed = feedLookup.get(right.feed_id);
      const feedCompare = (leftFeed?.title ?? left.feed_title).localeCompare(
        rightFeed?.title ?? right.feed_title,
      );
      if (feedCompare !== 0) {
        return feedCompare;
      }
    }

    const leftPublished = parseDate(left.published_at);
    const rightPublished = parseDate(right.published_at);
    if (leftPublished !== rightPublished) {
      return sort === "oldest" ? leftPublished - rightPublished : rightPublished - leftPublished;
    }

    if (sort === "source") {
      return left.title.localeCompare(right.title);
    }

    return left.title.localeCompare(right.title);
  });
}

function compareSearchResults(left: SearchResponsePayload["results"][number], right: SearchResponsePayload["results"][number]): number {
  if (left.match_score !== right.match_score) {
    return right.match_score - left.match_score;
  }

  if (left.kind !== right.kind) {
    return left.kind === "source" ? -1 : 1;
  }

  if (left.kind === "article" && right.kind === "article") {
    const leftTime = parseDate(left.published_at);
    const rightTime = parseDate(right.published_at);
    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }
    return left.title.localeCompare(right.title);
  }

  return left.title.localeCompare(right.title);
}

function compareAutocompleteSuggestions(
  left: AutocompleteSuggestion,
  right: AutocompleteSuggestion,
): number {
  const leftScore = "match_score" in left ? left.match_score : 0;
  const rightScore = "match_score" in right ? right.match_score : 0;
  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  if (left.type !== right.type) {
    return left.type === "feed" ? -1 : left.type === "article" && right.type === "topic" ? -1 : 1;
  }

  if (left.type === "article" && right.type === "article") {
    const leftTime = parseDate(left.published_at);
    const rightTime = parseDate(right.published_at);
    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }
  }

  if (left.type === "topic" && right.type === "topic") {
    if (left.feed_count !== right.feed_count) {
      return right.feed_count - left.feed_count;
    }
    return left.label.localeCompare(right.label);
  }

  return left.title.localeCompare(right.title);
}

function buildFeedLookup(feeds: FeedSource[]): Map<string, FeedSource> {
  return new Map(feeds.map((feed) => [getFeedIdentifier(feed), feed]));
}

function buildBoundedSearchMeta(candidateSources: number, scannedSources: number): SearchResponseMeta {
  return {
    mode: "bounded",
    bounded: true,
    candidate_sources: candidateSources,
    scanned_sources: scannedSources,
    scan_limit: DEFAULT_BROWSE_LIMIT,
    per_source_limit: null,
    truncated: candidateSources > scannedSources,
  };
}

function buildUnboundedSearchMeta(candidateSources: number): SearchResponseMeta {
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

function createEmptyCorpus(fileMtimeMs?: number): ArticleCorpus {
  return {
    metadata: {
      generated_at: timestampFromMtime(fileMtimeMs),
      source_db: CANONICAL_DATABASE_PATH,
      article_count: 0,
      feed_count: 0,
      latest_published_at: null,
      is_empty: true,
    },
    articles: [],
  };
}

function dedupeArticles(articles: ArticleCorpusArticle[]): ArticleCorpusArticle[] {
  const seen = new Set<string>();
  const deduped: ArticleCorpusArticle[] = [];

  for (const article of articles) {
    const key = article.id || `${article.feed_id}:${article.link}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(article);
  }

  return deduped;
}

function normalizeStringList(values: readonly string[] | string[] | null | undefined): string[] {
  if (!values) {
    return [];
  }

  const source = Array.isArray(values) ? values : [values];
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of source) {
    const text = normalizeText(value);
    if (!text || seen.has(text)) {
      continue;
    }

    seen.add(text);
    normalized.push(text);
  }

  return normalized;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (typeof entry === "string") {
      return entry.split(",");
    }

    if (entry && typeof entry === "object" && "term" in entry) {
      const term = (entry as Record<string, unknown>).term;
      return typeof term === "string" ? [term] : [];
    }

    return [];
  });
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function readBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeSearchQuery(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9+.#/-]+/i)
    .filter((token) => token.length > 0);
}

function scoreText(query: string | null | undefined, text: string | null | undefined, weight: number): number {
  const normalizedQuery = normalizeSearchQuery(query);
  const haystack = normalizeText(text);
  if (!normalizedQuery || !haystack) {
    return 0;
  }

  const tokens = tokenize(normalizedQuery);
  let score = 0;

  if (haystack.includes(normalizedQuery)) {
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

function scoreList(query: string | null | undefined, values: readonly string[], weight: number): number {
  return values.reduce((total, value) => total + scoreText(query, value, weight), 0);
}

function getFeedIdentifier(feed: FeedSource): string {
  return feed.id || feed.title || feed.url;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function parseDate(value: string | null): number {
  if (!value) {
    return Number.MIN_SAFE_INTEGER;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.MIN_SAFE_INTEGER;
}

function maxPublishedAt(values: Array<string | null>): string | null {
  let bestTime = Number.MIN_SAFE_INTEGER;
  let bestValue: string | null = null;

  for (const value of values) {
    const parsed = parseDate(value);
    if (parsed > bestTime) {
      bestTime = parsed;
      bestValue = value;
    }
  }

  return bestValue;
}

function timestampFromMtime(mtimeMs?: number): string | null {
  if (typeof mtimeMs !== "number" || !Number.isFinite(mtimeMs)) {
    return null;
  }

  return new Date(mtimeMs).toISOString();
}
