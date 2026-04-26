import { beforeEach, describe, expect, it, vi } from "vitest";

const { streamAggregatedFeedPostsByIdsMock } = vi.hoisted(() => ({
  streamAggregatedFeedPostsByIdsMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/feed-posts", () => ({
  streamAggregatedFeedPostsByIds: streamAggregatedFeedPostsByIdsMock,
}));

import { GET, POST } from "./route";

async function readNdjson(response: Response) {
  const text = await response.text();
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { type: string; [key: string]: unknown });
}

describe("/api/feeds/posts/aggregate/stream", () => {
  beforeEach(() => {
    streamAggregatedFeedPostsByIdsMock.mockReset();
  });

  it("requires feed ids", async () => {
    const response = await GET(new Request("http://localhost/api/feeds/posts/aggregate/stream"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "feedIds is required" });
  });

  it("streams feed events as newline-delimited JSON", async () => {
    streamAggregatedFeedPostsByIdsMock.mockImplementation(async function* () {
      yield {
        type: "start",
        totalSources: 2,
        limit: 48,
        perFeedLimit: 3,
        fetchedAt: "2026-04-13T12:00:00.000Z",
      };
      yield {
        type: "feed",
        feedId: "feed-1",
        feedTitle: "Agent Feed",
        successfulSources: 1,
        failedSources: 0,
        posts: [
          {
            id: "post-1",
            feedId: "feed-1",
            feedTitle: "Agent Feed",
            sourceUrl: "https://example.com/feed.xml",
            resolvedFeedUrl: "https://example.com/feed.xml",
            title: "Agent systems",
            link: "https://example.com/post-1",
            summary: "Streaming result",
            author: "Ari",
            categories: ["agents"],
            publishedAt: "2026-04-13T12:00:00.000Z",
          },
        ],
      };
      yield {
        type: "feed_error",
        feedId: "feed-2",
        feedTitle: "Slow Feed",
        message: "Request timed out",
        successfulSources: 1,
        failedSources: 1,
      };
      yield {
        type: "done",
        totalSources: 2,
        successfulSources: 1,
        failedSources: 1,
        totalMatchedPosts: 1,
        fetchedAt: "2026-04-13T12:00:00.000Z",
      };
    });

    const response = await POST(
      new Request("http://localhost/api/feeds/posts/aggregate/stream", {
        method: "POST",
        body: JSON.stringify({
          feedIds: ["feed-1", "feed-2"],
          limit: 24,
          perFeedLimit: 3,
          refresh: true,
          q: "agent",
          sort: "latest",
        }),
      }),
    );

    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(await readNdjson(response)).toEqual([
      expect.objectContaining({ type: "start", totalSources: 2 }),
      expect.objectContaining({ type: "feed", feedId: "feed-1" }),
      expect.objectContaining({ type: "feed_error", feedId: "feed-2" }),
      expect.objectContaining({ type: "done", successfulSources: 1, failedSources: 1 }),
    ]);
    expect(streamAggregatedFeedPostsByIdsMock).toHaveBeenCalledWith(["feed-1", "feed-2"], 48, 3, {
      forceRefresh: true,
    });
  });
});
