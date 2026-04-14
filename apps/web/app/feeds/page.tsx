import type { Metadata } from "next";
import { FeedsWorkspaceClient, type FeedsWorkspaceMode } from "./feeds-workspace-client";
import { browseArticleCorpus } from "@/lib/article-corpus";
import { getFeedStats, loadFeedCatalog } from "@/lib/feeds";
import {
  normalizeSearchQuery,
  parseSearchFeedIdsParam,
  parseSearchTopicsParam,
  parseVerifiedSearchFilter,
} from "@/lib/search";

export const metadata: Metadata = {
  title: "Feeds Workspace - AIWebFeeds",
  description: "Browse the article corpus and source catalog from one reader-first workspace.",
  openGraph: {
    title: "Feeds Workspace - AIWebFeeds",
    description: "Browse the article corpus and source catalog from one unified workspace.",
  },
};

type FeedsPageSearchParams = Record<string, string | string[] | undefined>;

type FeedsPageProps = {
  searchParams: Promise<FeedsPageSearchParams>;
};

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
    categories: string[];
    topics: string[];
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
    source_db: string;
    article_count: number;
    feed_count: number;
    latest_published_at: string | null;
    is_empty: boolean;
  };
};

function toURLSearchParams(searchParams: FeedsPageSearchParams): URLSearchParams {
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

function parseMode(searchParams: URLSearchParams): FeedsWorkspaceMode {
  const rawMode = searchParams.get("mode")?.trim().toLowerCase();
  return rawMode === "catalog" ? "catalog" : "reader";
}

function parseSort(searchParams: URLSearchParams): FeedsWorkspaceInitialState["sort"] {
  const rawSort =
    searchParams.get("sort")?.trim().toLowerCase() ??
    searchParams.get("reader_sort")?.trim().toLowerCase() ??
    "";

  if (rawSort === "oldest" || rawSort === "source") {
    return rawSort;
  }

  return "latest";
}

function parseReaderView(searchParams: URLSearchParams): FeedsWorkspaceInitialState["readerView"] {
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

function parseCursor(searchParams: URLSearchParams): number {
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

function parseLimit(searchParams: URLSearchParams): number {
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

function parseInitialState(searchParams: URLSearchParams): FeedsWorkspaceInitialState {
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

export default async function FeedsPage({ searchParams }: FeedsPageProps) {
  const resolvedSearchParams = toURLSearchParams(await searchParams);
  const mode = parseMode(resolvedSearchParams);
  const feedsData = loadFeedCatalog();
  const stats = getFeedStats(feedsData.sources);
  const initialState = parseInitialState(resolvedSearchParams);
  const initialBrowse =
    mode === "catalog"
      ? null
      : ((await browseArticleCorpus({
          q: initialState.query,
          feedIds: initialState.feedIds,
          sourceType: initialState.sourceType ?? undefined,
          topics: initialState.topics,
          verified: initialState.verified ?? undefined,
          sort: initialState.sort,
          cursor: initialState.cursor,
          limit: initialState.limit,
        })) as FeedsWorkspaceInitialBrowse);

  return (
    <div className="page-wrap page-stack">
      <section className="surface-panel space-y-8">
        <FeedsWorkspaceClient
          mode={mode}
          feeds={feedsData.sources}
          stats={stats}
          initialState={initialState}
          initialBrowse={initialBrowse}
        />
      </section>
    </div>
  );
}
