import { browseArticleCorpus } from "@/lib/article-corpus";
import { getFeedStats, loadFeedCatalog } from "@/lib/feeds";
import {
  normalizeSearchQuery,
  parseSearchFeedIdsParam,
  parseSearchTopicsParam,
  parseVerifiedSearchFilter,
} from "@/lib/search";

export type FeedsWorkspaceMode = "catalog" | "reader";

export type ReaderPageSearchParams = Record<string, string | string[] | undefined>;

export type FeedsWorkspaceInitialState = {
  query: string;
  feedIds: string[];
  sourceType: string | null;
  topics: string[];
  verified: boolean | null;
  sort: "latest" | "oldest" | "source";
  readerView: "latest" | "unread" | "starred" | "saved" | "archived";
  cursor: number;
  limit: number;
};

export type FeedsWorkspaceInitialBrowse = {
  items: Array<{
    id: string;
    feed_id: string;
    feed_title: string;
    title: string;
    link: string;
    summary: string | null;
    content_html: string | null;
    author: string | null;
    published_at: string | null;
    topics: string[];
    source_topics: string[];
    raw_categories: string[];
    source_type: string;
    verified: boolean;
    is_active: boolean;
  }>;
  next_cursor: number | null;
  total_matched: number;
  cursor: number;
  limit: number;
  applied_query: string | null;
  applied_sort: "latest" | "oldest" | "source";
  corpus: {
    generated_at: string | null;
    schema_version: string;
    source_db: string;
    article_count: number;
    feed_count: number;
    latest_published_at: string | null;
    freshness_watermark: string | null;
    is_empty: boolean;
  };
};

export type ReaderRouteData = {
  mode: FeedsWorkspaceMode;
  feeds: ReturnType<typeof loadFeedCatalog>["sources"];
  stats: ReturnType<typeof getFeedStats>;
  initialState: FeedsWorkspaceInitialState;
  initialBrowse: FeedsWorkspaceInitialBrowse | null;
};

export type URLSearchParamsLike = Pick<URLSearchParams, "get" | "getAll">;

export async function loadReaderRouteData(
  searchParamsPromise: Promise<ReaderPageSearchParams>,
): Promise<ReaderRouteData> {
  const resolvedSearchParams = toURLSearchParams(await searchParamsPromise);
  const mode = parseMode(resolvedSearchParams);
  const feedsData = loadFeedCatalog();
  const stats = getFeedStats(feedsData.sources);
  const initialState = parseInitialState(resolvedSearchParams);
  const initialBrowse =
    mode === "catalog"
      ? null
      : await browseArticleCorpus({
          q: initialState.query,
          feedIds: initialState.feedIds,
          sourceType: initialState.sourceType ?? undefined,
          topics: initialState.topics,
          verified: initialState.verified ?? undefined,
          sort: initialState.sort,
          cursor: initialState.cursor,
          limit: initialState.limit,
        }).catch(() => null);

  return {
    mode,
    feeds: feedsData.sources,
    stats,
    initialState,
    initialBrowse,
  };
}

function toURLSearchParams(searchParams: ReaderPageSearchParams): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      const normalizedValues = value.filter((entry): entry is string => typeof entry === "string");
      if (normalizedValues.length === 0) {
        continue;
      }

      if (key === "topics") {
        params.set(key, normalizedValues.join(","));
      } else {
        for (const entry of normalizedValues) {
          params.append(key, entry);
        }
      }
      continue;
    }

    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  return params;
}

export function parseMode(searchParams: URLSearchParamsLike): FeedsWorkspaceMode {
  const rawMode = searchParams.get("mode")?.trim().toLowerCase();
  return rawMode === "catalog" ? "catalog" : "reader";
}

export function parseSort(searchParams: URLSearchParamsLike): FeedsWorkspaceInitialState["sort"] {
  const rawSort = searchParams.get("sort")?.trim().toLowerCase() ?? "";

  if (rawSort === "oldest" || rawSort === "source") {
    return rawSort;
  }

  return "latest";
}

export function parseReaderView(
  searchParams: URLSearchParamsLike,
): FeedsWorkspaceInitialState["readerView"] {
  const rawView = searchParams.get("reader_view")?.trim().toLowerCase() ?? "";
  if (
    rawView === "unread" ||
    rawView === "starred" ||
    rawView === "saved" ||
    rawView === "archived"
  ) {
    return rawView;
  }

  return "latest";
}

export function parseCursor(searchParams: URLSearchParamsLike): number {
  const rawCursor = searchParams.get("cursor");
  if (!rawCursor) {
    return 0;
  }

  const parsed = Number.parseInt(rawCursor, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.trunc(parsed);
}

export function parseLimit(searchParams: URLSearchParamsLike): number {
  const rawLimit = searchParams.get("limit");
  if (!rawLimit) {
    return 24;
  }

  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed)) {
    return 24;
  }

  return Math.max(1, Math.min(100, Math.trunc(parsed)));
}

export function parseInitialState(searchParams: URLSearchParamsLike): FeedsWorkspaceInitialState {
  const normalizedSourceType = searchParams.get("source_type")?.trim();
  const verified = parseVerifiedSearchFilter(searchParams.get("verified"));

  return {
    query: normalizeSearchQuery(searchParams.get("q")) ?? "",
    feedIds: parseSearchFeedIdsParam(searchParams.getAll("feed")),
    sourceType:
      normalizedSourceType && normalizedSourceType.length > 0 ? normalizedSourceType : null,
    topics: parseSearchTopicsParam(searchParams.getAll("topics").join(",")),
    verified: verified ?? null,
    sort: parseSort(searchParams),
    readerView: parseReaderView(searchParams),
    cursor: parseCursor(searchParams),
    limit: parseLimit(searchParams),
  };
}
