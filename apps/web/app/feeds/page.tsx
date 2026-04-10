import type { Metadata } from "next";
import {
  SearchPageClient,
  type InitialSearchRequestState,
} from "@/components/search/search-page-client";
import { ReaderPageClient } from "@/components/reader/reader-page-client";
import { loadFeedCatalog, getSourceTypes, getFeedStats } from "@/lib/feeds";
import { runLocalSearch } from "@/lib/search-local";
import {
  DEFAULT_UNBOUNDED_SEARCH_META,
  normalizeSearchQuery,
  parseSearchStateFromParams,
  parseVerifiedSearchFilter,
  type SearchExecutionState,
  type SearchResponseMeta,
  type SearchResult,
} from "@/lib/search";
import { FeedCatalog } from "./feed-catalog";
import { FeedsWorkspaceClient, type FeedsWorkspaceMode } from "./feeds-workspace-client";

export const metadata: Metadata = {
  title: "Feeds Workspace - AIWebFeeds",
  description:
    "Browse curated AI feeds, search recent posts, and read the merged timeline from one canonical workspace.",
  openGraph: {
    title: "Feeds Workspace - AIWebFeeds",
    description: "Browse, search, and read AI feeds from one unified workspace.",
  },
};

type FeedsPageSearchParams = Record<string, string | string[] | undefined>;

type FeedsPageProps = {
  searchParams: Promise<FeedsPageSearchParams>;
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
  if (rawMode === "articles" || rawMode === "reader") {
    return rawMode;
  }

  return "catalog";
}

async function getInitialArticleSearchData(searchParams: URLSearchParams): Promise<{
  initialQuery: string;
  initialSearchState: SearchExecutionState;
  initialResults: SearchResult[];
  initialMeta: SearchResponseMeta;
  initialSearchRequestState: InitialSearchRequestState;
  shouldLogInitialSearch: boolean;
}> {
  const initialQuery = normalizeSearchQuery(searchParams.get("q")) ?? "";
  const initialSearchState: SearchExecutionState = {
    ...parseSearchStateFromParams(searchParams),
    scope: "articles",
    searchType: "articles",
    search_type: "articles",
  };

  if (!initialQuery) {
    return buildArticleSearchData(initialQuery, initialSearchState, "idle");
  }

  try {
    const payload = await runLocalSearch({
      query: initialQuery,
      scope: "articles",
      limit: 20,
      feedIds: initialSearchState.feed_ids,
      sourceType: initialSearchState.source_type,
      topics: initialSearchState.topics,
      verified: initialSearchState.verified,
    });

    return buildArticleSearchData(initialQuery, initialSearchState, "success", {
      initialResults: payload.results,
      initialMeta: payload.meta,
      shouldLogInitialSearch: true,
    });
  } catch (error) {
    console.error("Initial article search hydration error:", error);
    return buildArticleSearchData(initialQuery, initialSearchState, "failed");
  }
}

function buildArticleSearchData(
  initialQuery: string,
  initialSearchState: SearchExecutionState,
  initialSearchRequestState: InitialSearchRequestState,
  overrides?: Partial<{
    initialResults: SearchResult[];
    initialMeta: SearchResponseMeta;
    shouldLogInitialSearch: boolean;
  }>,
) {
  return {
    initialQuery,
    initialSearchState,
    initialResults: overrides?.initialResults ?? [],
    initialMeta: overrides?.initialMeta ?? DEFAULT_UNBOUNDED_SEARCH_META,
    initialSearchRequestState,
    shouldLogInitialSearch: overrides?.shouldLogInitialSearch ?? false,
  };
}

export default async function FeedsPage({ searchParams }: FeedsPageProps) {
  const resolvedSearchParams = toURLSearchParams(await searchParams);
  const mode = parseMode(resolvedSearchParams);
  const feedsData = loadFeedCatalog();
  const feeds = feedsData.sources;
  const types = getSourceTypes(feeds);
  const stats = getFeedStats(feeds);
  const initialQuery = normalizeSearchQuery(resolvedSearchParams.get("q")) ?? "";
  const initialSourceType = resolvedSearchParams.get("source_type")?.trim() || null;
  const initialTopic =
    resolvedSearchParams.get("topics")?.split(",")[0]?.trim() ||
    resolvedSearchParams.get("topic")?.trim() ||
    null;
  const initialVerified = parseVerifiedSearchFilter(resolvedSearchParams.get("verified")) ?? null;
  const articleSearchData =
    mode === "articles"
      ? await getInitialArticleSearchData(resolvedSearchParams)
      : buildArticleSearchData(
          "",
          {
            ...parseSearchStateFromParams(new URLSearchParams()),
            scope: "articles",
            searchType: "articles",
            search_type: "articles",
            feed_ids: [],
          },
          "idle",
        );
  const readerFeeds = feeds.map((feed) => ({
    id: feed.id || feed.url,
    title: feed.title,
    sourceType: feed.source_type || "feed",
    topics: feed.topics ?? [],
    verified: feed.verified === true,
    isActive: feed.is_active !== false,
    url: feed.url,
  }));

  return (
    <div className="page-wrap page-stack">
      <section className="surface-panel space-y-8">
        <FeedsWorkspaceClient mode={mode} stats={stats} />
        {mode === "articles" ? (
          <SearchPageClient
            {...articleSearchData}
            basePath="/feeds"
            browseFeedsHref="/feeds"
            embedded
            forceScope="articles"
            readerBasePath="/feeds"
            readerMode="reader"
            routeMode="articles"
          />
        ) : mode === "reader" ? (
          <ReaderPageClient feeds={readerFeeds} />
        ) : (
          <FeedCatalog
            feeds={feeds}
            sourceTypes={types}
            initialQuery={initialQuery}
            initialSourceType={initialSourceType}
            initialTopic={initialTopic}
            initialVerified={initialVerified}
          />
        )}
      </section>
    </div>
  );
}
