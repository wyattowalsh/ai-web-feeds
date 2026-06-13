import { NextResponse } from "next/server";

import {
  loadAggregatedFeedPostsByIds,
  type AggregateFeedPost,
  type AggregateFeedPostsResponse,
} from "@/lib/feed-posts";
import { normalizeSearchQuery } from "@/lib/search";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";
const MAX_LIVE_FEED_IDS = 48;

type AggregateSort = "latest" | "oldest" | "title" | "source";
type AggregateStream = "sample" | "all";

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const feedIds = readFeedIds(searchParams);

  if (feedIds.length === 0) {
    return NextResponse.json(
      { error: 'At least one "feed" query parameter is required' },
      { status: 400 },
    );
  }

  if (feedIds.length > MAX_LIVE_FEED_IDS) {
    return NextResponse.json(
      {
        error: `Live aggregate requests are limited to ${MAX_LIVE_FEED_IDS} feed IDs. Narrow filters or use the generated article corpus.`,
      },
      { status: 413 },
    );
  }

  const limit = clampNumber(searchParams.get("limit"), 1, 48, 24);
  const stream = parseAggregateStream(searchParams.get("stream"));
  const perFeedLimit = clampNumber(
    searchParams.get("per_feed_limit"),
    1,
    8,
    stream === "all" ? 8 : 3,
  );
  const cursor = stream === "sample" ? 0 : clampNumber(searchParams.get("cursor"), 0, 500, 0);
  const sort = parseAggregateSort(searchParams.get("sort"));
  const query = normalizeSearchQuery(searchParams.get("q"));
  const totalLimit = Math.max(cursor + limit, feedIds.length * perFeedLimit, 48);

  try {
    const payload = await loadAggregatedFeedPostsByIds(feedIds, totalLimit, perFeedLimit, {
      forceRefresh: searchParams.get("refresh") === "true",
    });

    const filteredPosts = sortAggregatePosts(
      query ? payload.posts.filter((post) => postMatchesQuery(post, query)) : payload.posts,
      sort,
    );

    return NextResponse.json(
      {
        ...payload,
        posts: filteredPosts.slice(cursor, cursor + limit),
        cursor,
        next_cursor:
          stream !== "sample" && cursor + limit < filteredPosts.length ? cursor + limit : null,
        total_matched_posts: filteredPosts.length,
        applied_query: query,
        applied_sort: sort,
        applied_stream: stream,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load aggregated feed posts";
    return NextResponse.json({ error: message }, { status: 502 });
  }
};

const POSTHandler = async (request: Request) => {
  const body = (await request.json().catch(() => null)) as {
    feedIds?: string[];
    limit?: number;
    perFeedLimit?: number;
    refresh?: boolean;
    q?: string | null;
    sort?: string | null;
  } | null;

  if (!Array.isArray(body?.feedIds) || body.feedIds.length === 0) {
    return NextResponse.json({ error: "feedIds is required" }, { status: 400 });
  }

  if (body.feedIds.length > MAX_LIVE_FEED_IDS) {
    return NextResponse.json(
      {
        error: `Live aggregate requests are limited to ${MAX_LIVE_FEED_IDS} feed IDs. Narrow filters or use the generated article corpus.`,
      },
      { status: 413 },
    );
  }

  const limit = clampNumber(body.limit, 1, 48, 24);
  const perFeedLimit = clampNumber(body.perFeedLimit, 1, 8, 2);
  const totalLimit = Math.max(limit, body.feedIds.length * perFeedLimit, 48);
  const query = normalizeSearchQuery(body.q ?? null);
  const sort = parseAggregateSort(body.sort ?? null);

  try {
    const payload = await loadAggregatedFeedPostsByIds(body.feedIds, totalLimit, perFeedLimit, {
      forceRefresh: body.refresh === true,
    });
    const filteredPosts = sortAggregatePosts(
      query ? payload.posts.filter((post) => postMatchesQuery(post, query)) : payload.posts,
      sort,
    );

    return NextResponse.json(
      {
        ...payload,
        posts: filteredPosts.slice(0, limit),
        cursor: 0,
        next_cursor: limit < filteredPosts.length ? limit : null,
        total_matched_posts: filteredPosts.length,
        applied_query: query,
        applied_sort: sort,
        applied_stream: "sample",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load aggregated feed posts";
    return NextResponse.json({ error: message }, { status: 502 });
  }
};

function readFeedIds(searchParams: URLSearchParams): string[] {
  return Array.from(
    new Set(
      searchParams
        .getAll("feed")
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function clampNumber(
  value: number | string | null | undefined,
  min: number,
  max: number,
  defaultValue: number,
): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function parseAggregateSort(value: string | null): AggregateSort {
  switch (value) {
    case "oldest":
    case "title":
    case "source":
      return value;
    default:
      return "latest";
  }
}

function parseAggregateStream(value: string | null): AggregateStream {
  switch (value) {
    case "all":
      return value;
    case "sample":
    default:
      return "sample";
  }
}

function postMatchesQuery(post: AggregateFeedPost, query: string): boolean {
  const normalizedQuery = query.toLowerCase();
  const haystack = [
    post.title,
    post.feedTitle,
    post.summary ?? "",
    post.author ?? "",
    post.rawCategories.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function sortAggregatePosts(
  posts: AggregateFeedPostsResponse["posts"],
  sort: AggregateSort,
): AggregateFeedPostsResponse["posts"] {
  return [...posts].sort((left, right) => {
    if (sort === "title") {
      return left.title.localeCompare(right.title);
    }

    if (sort === "source") {
      const feedTitleCompare = left.feedTitle.localeCompare(right.feedTitle);
      if (feedTitleCompare !== 0) {
        return feedTitleCompare;
      }

      return comparePostTimestamps(left.publishedAt, right.publishedAt);
    }

    const timestampComparison = comparePostTimestamps(left.publishedAt, right.publishedAt);
    if (sort === "oldest") {
      return -timestampComparison;
    }

    return timestampComparison;
  });
}

function comparePostTimestamps(left: string | null, right: string | null): number {
  const leftTime = left ? Date.parse(left) : Number.NaN;
  const rightTime = right ? Date.parse(right) : Number.NaN;

  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
    return 0;
  }

  if (Number.isNaN(leftTime)) {
    return 1;
  }

  if (Number.isNaN(rightTime)) {
    return -1;
  }

  return rightTime - leftTime;
}

export const GET = withRouteTelemetry("feeds.posts.aggregate.list", GETHandler);
export const POST = withRouteTelemetry("feeds.posts.aggregate", POSTHandler);
