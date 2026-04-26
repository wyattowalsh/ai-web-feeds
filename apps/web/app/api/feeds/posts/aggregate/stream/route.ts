import { NextResponse } from "next/server";
import { streamAggregatedFeedPostsByIds, type AggregateFeedStreamEvent } from "@/lib/feed-posts";
import { normalizeSearchQuery } from "@/lib/search";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";

type StreamBody = {
  feedIds?: string[];
  limit?: number;
  perFeedLimit?: number;
  refresh?: boolean;
  q?: string | null;
  sort?: string | null;
};

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  return streamResponse({
    feedIds: readFeedIds(searchParams),
    limit: clampNumber(searchParams.get("limit"), 1, 48, 24),
    perFeedLimit: clampNumber(searchParams.get("per_feed_limit"), 1, 8, 2),
    refresh: searchParams.get("refresh") === "true",
    q: searchParams.get("q"),
    sort: searchParams.get("sort"),
  });
};

const POSTHandler = async (request: Request) => {
  const body = (await request.json().catch(() => null)) as StreamBody | null;

  return streamResponse({
    feedIds: Array.isArray(body?.feedIds) ? body.feedIds : [],
    limit: clampNumber(body?.limit, 1, 48, 24),
    perFeedLimit: clampNumber(body?.perFeedLimit, 1, 8, 2),
    refresh: body?.refresh === true,
    q: body?.q ?? null,
    sort: body?.sort ?? null,
  });
};

function streamResponse({
  feedIds,
  limit,
  perFeedLimit,
  refresh,
  q,
  sort,
}: Required<Pick<StreamBody, "feedIds" | "limit" | "perFeedLimit" | "refresh">> & {
  q: string | null;
  sort: string | null;
}) {
  if (feedIds.length === 0) {
    return NextResponse.json({ error: "feedIds is required" }, { status: 400 });
  }

  const query = normalizeSearchQuery(q);
  const aggregateSort = parseAggregateSort(sort);
  const totalLimit = Math.max(limit, feedIds.length * perFeedLimit, 48);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AggregateFeedStreamEvent | { type: "error"; message: string }) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        for await (const event of streamAggregatedFeedPostsByIds(
          feedIds,
          totalLimit,
          perFeedLimit,
          { forceRefresh: refresh },
        )) {
          if (event.type !== "feed") {
            send(event);
            continue;
          }

          const posts = sortAggregatePosts(
            query ? event.posts.filter((post) => postMatchesQuery(post, query)) : event.posts,
            aggregateSort,
          );
          if (posts.length === 0) {
            send({ ...event, posts: [] });
            continue;
          }

          send({ ...event, posts });
        }
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Failed to stream feed posts",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

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
  fallback: number,
): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function parseAggregateSort(value: string | null): "latest" | "oldest" | "source" {
  switch (value) {
    case "oldest":
    case "source":
      return value;
    default:
      return "latest";
  }
}

function postMatchesQuery(
  post: {
    title: string;
    feedTitle: string;
    summary: string | null;
    author: string | null;
    categories: string[];
  },
  query: string,
): boolean {
  const normalizedQuery = query.toLowerCase();
  const haystack = [
    post.title,
    post.feedTitle,
    post.summary ?? "",
    post.author ?? "",
    post.categories.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function sortAggregatePosts<
  T extends { publishedAt: string | null; title: string; feedTitle: string },
>(posts: T[], sort: "latest" | "oldest" | "source"): T[] {
  return [...posts].sort((left, right) => {
    if (sort === "source") {
      const feedTitleCompare = left.feedTitle.localeCompare(right.feedTitle);
      if (feedTitleCompare !== 0) {
        return feedTitleCompare;
      }
    }

    const comparison = comparePostTimestamps(left.publishedAt, right.publishedAt);
    return sort === "oldest" ? -comparison : comparison;
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

export const GET = withRouteTelemetry("feeds.posts.aggregate.stream.list", GETHandler);
export const POST = withRouteTelemetry("feeds.posts.aggregate.stream", POSTHandler);
