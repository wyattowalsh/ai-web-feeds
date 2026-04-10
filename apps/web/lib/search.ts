export type SearchScope = "sources" | "articles";
export type SearchType = SearchScope;

export type SearchFilterInput = {
  search_type?: SearchType | string;
  scope?: SearchScope | string;
  feed_ids?: string[] | string;
  source_type?: string;
  topics?: string[] | string;
  verified?: boolean | string;
  threshold?: number | string;
};

export type SearchFilters = {
  search_type?: SearchType;
  scope?: SearchScope;
  feed_ids?: string[];
  source_type?: string;
  topics?: string[];
  verified?: boolean;
  threshold?: number;
};

export type SearchExecutionState = Omit<SearchFilters, "topics" | "feed_ids"> & {
  scope: SearchScope;
  searchType: SearchType;
  search_type: SearchType;
  feed_ids: string[];
  topics: string[];
  threshold: number;
};

export type BaseSearchResult = {
  id: string;
  title: string;
  description?: string | null;
  url: string;
  topics: string[];
  source_type: string;
  verified: boolean;
  is_active: boolean;
  match_score: number;
};

export type SourceSearchResult = BaseSearchResult & {
  kind: "source";
};

export type ArticleSearchResult = BaseSearchResult & {
  kind: "article";
  feed_id: string;
  feed_title: string;
  published_at?: string | null;
};

export type SearchResult = SourceSearchResult | ArticleSearchResult;

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
  scope: SearchScope;
  results: SearchResult[];
  meta: SearchResponseMeta;
};

export const DEFAULT_SEARCH_THRESHOLD = 0.7;
export const MIN_SEARCH_THRESHOLD = 0.5;
export const MAX_SEARCH_THRESHOLD = 1;
export const DEFAULT_SEARCH_SCOPE: SearchScope = "sources";
export const DEFAULT_UNBOUNDED_SEARCH_META: SearchResponseMeta = {
  mode: "unbounded",
  bounded: false,
  candidate_sources: 0,
  scanned_sources: 0,
  scan_limit: null,
  per_source_limit: null,
  truncated: false,
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeFeedIds(feedIds: readonly string[] | null | undefined): string[] {
  if (!feedIds) {
    return [];
  }

  const normalizedFeedIds: string[] = [];
  const seen = new Set<string>();

  for (const feedId of feedIds) {
    const normalizedFeedId = collapseWhitespace(String(feedId));
    if (!normalizedFeedId || seen.has(normalizedFeedId)) {
      continue;
    }

    seen.add(normalizedFeedId);
    normalizedFeedIds.push(normalizedFeedId);
  }

  return normalizedFeedIds;
}

export function normalizeSearchQuery(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = collapseWhitespace(value);
  return normalized.length > 0 ? normalized : null;
}

export function parseSearchType(value: string | null | undefined): SearchType {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "articles" || normalized === "semantic") {
    return "articles";
  }

  return DEFAULT_SEARCH_SCOPE;
}

export function parseSearchScope(value: string | null | undefined): SearchScope {
  return parseSearchType(value);
}

export function toBackendSearchType(value: SearchType): "full_text" | "semantic" {
  return value === "articles" ? "semantic" : "full_text";
}

export function parseVerifiedSearchFilter(value: string | null | undefined): boolean | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return undefined;
}

export function normalizeSearchTopics(topics: readonly string[] | null | undefined): string[] {
  if (!topics) {
    return [];
  }

  const normalizedTopics: string[] = [];
  const seen = new Set<string>();

  for (const topic of topics) {
    const normalizedTopic = normalizeSearchQuery(topic)?.toLowerCase();
    if (!normalizedTopic || seen.has(normalizedTopic)) {
      continue;
    }

    seen.add(normalizedTopic);
    normalizedTopics.push(normalizedTopic);
  }

  return normalizedTopics;
}

export function parseSearchTopicsParam(value: string | null | undefined): string[] {
  if (typeof value !== "string") {
    return [];
  }

  return normalizeSearchTopics(value.split(","));
}

export function parseSearchFeedIdsParam(
  value: readonly string[] | string | null | undefined,
): string[] {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? value : String(value).split(",");
  return normalizeFeedIds(values);
}

export function parseThresholdSearchFilter(value: number | string | null | undefined): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return DEFAULT_SEARCH_THRESHOLD;
  }

  return clampNumber(parsed, MIN_SEARCH_THRESHOLD, MAX_SEARCH_THRESHOLD);
}

export function normalizeSearchFilters(
  filters:
    | (SearchFilterInput & Record<string, unknown>)
    | Record<string, unknown>
    | SearchFilterInput
    | null
    | undefined,
): SearchFilters {
  if (!filters) {
    return {};
  }

  const normalized: SearchFilters = {};

  if (typeof filters.search_type === "string") {
    normalized.search_type = parseSearchType(filters.search_type);
  }

  if (typeof filters.scope === "string") {
    normalized.scope = parseSearchScope(filters.scope);
  }

  if (typeof filters.source_type === "string") {
    const normalizedSourceType = normalizeSearchQuery(filters.source_type);
    if (normalizedSourceType) {
      normalized.source_type = normalizedSourceType;
    }
  }

  if (Array.isArray(filters.feed_ids)) {
    const normalizedFeedIds = parseSearchFeedIdsParam(filters.feed_ids);
    if (normalizedFeedIds.length > 0) {
      normalized.feed_ids = normalizedFeedIds;
    }
  } else if (typeof filters.feed_ids === "string") {
    const normalizedFeedIds = parseSearchFeedIdsParam(filters.feed_ids);
    if (normalizedFeedIds.length > 0) {
      normalized.feed_ids = normalizedFeedIds;
    }
  }

  if (Array.isArray(filters.topics)) {
    const normalizedTopics = normalizeSearchTopics(
      filters.topics.filter((topic): topic is string => typeof topic === "string"),
    );
    if (normalizedTopics.length > 0) {
      normalized.topics = normalizedTopics;
    }
  } else if (typeof filters.topics === "string") {
    const normalizedTopics = parseSearchTopicsParam(filters.topics);
    if (normalizedTopics.length > 0) {
      normalized.topics = normalizedTopics;
    }
  }

  if (typeof filters.verified === "boolean") {
    normalized.verified = filters.verified;
  } else if (typeof filters.verified === "string") {
    const normalizedVerified = parseVerifiedSearchFilter(filters.verified);
    if (normalizedVerified !== undefined) {
      normalized.verified = normalizedVerified;
    }
  }

  if (typeof filters.threshold === "number" || typeof filters.threshold === "string") {
    normalized.threshold = parseThresholdSearchFilter(filters.threshold);
  }

  return normalized;
}

export function parseSearchStateFromParams(
  searchParams: Pick<URLSearchParams, "get" | "getAll">,
): SearchExecutionState {
  const scope = parseSearchScope(searchParams.get("scope") || searchParams.get("type"));
  const normalizedFilters = normalizeSearchFilters({
    scope,
    feed_ids: parseSearchFeedIdsParam(searchParams.getAll("feed")),
    source_type: searchParams.get("source_type") ?? undefined,
    topics: parseSearchTopicsParam(searchParams.get("topics")),
    verified: parseVerifiedSearchFilter(searchParams.get("verified")),
    threshold: parseThresholdSearchFilter(searchParams.get("threshold")),
  });

  return {
    scope,
    searchType: scope,
    search_type: scope,
    feed_ids: normalizedFilters.feed_ids ?? [],
    source_type: normalizedFilters.source_type,
    topics: normalizedFilters.topics ?? [],
    verified: normalizedFilters.verified,
    threshold: normalizedFilters.threshold ?? DEFAULT_SEARCH_THRESHOLD,
  };
}
