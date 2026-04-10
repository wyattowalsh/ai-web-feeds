import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { useReaderTimeline } from "@/lib/use-reader-timeline";

function makeResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("useReaderTimeline", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats sample streams as a single fetch without pagination", async () => {
    const feedIds = ["feed-1"] as string[];

    fetchMock.mockResolvedValueOnce(
      makeResponse({
        posts: [
          {
            id: "post-1",
            feedId: "feed-1",
            feedTitle: "Agent Feed",
            sourceUrl: "https://example.com/feed-1",
            title: "Agent systems roundup",
            link: "https://example.com/post-1",
            summary: "Sample post",
            author: "Wyatt",
            categories: ["agents"],
            publishedAt: "2026-04-05T12:00:00.000Z",
          },
        ],
        feeds: [],
        fetchedAt: "2026-04-06T00:00:00.000Z",
        expiresAt: "2026-04-06T00:10:00.000Z",
        cacheState: "live",
        totalSources: 1,
        successfulSources: 1,
        failedSources: 0,
      }),
    );

    const { result } = renderHook(
      () =>
        useReaderTimeline(feedIds, {
          enabled: true,
          limit: 12,
          perFeedLimit: 3,
          stream: "sample",
        }),
      { reactStrictMode: false },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.articles).toHaveLength(1);
    expect(result.current.hasMore).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("stream=sample");
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain("cursor=");

    await act(async () => {
      await result.current.loadMore();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("paginates full streams and resets when the feed scope changes", async () => {
    fetchMock
      .mockResolvedValueOnce(
        makeResponse({
          posts: [
            {
              id: "post-1",
              feedId: "feed-1",
              feedTitle: "Agent Feed",
              sourceUrl: "https://example.com/feed-1",
              title: "Agent systems roundup",
              link: "https://example.com/post-1",
              summary: "First page",
              author: "Wyatt",
              categories: ["agents"],
              publishedAt: "2026-04-05T12:00:00.000Z",
            },
            {
              id: "post-2",
              feedId: "feed-1",
              feedTitle: "Agent Feed",
              sourceUrl: "https://example.com/feed-1",
              title: "Agent release notes",
              link: "https://example.com/post-2",
              summary: "First page",
              author: "Wyatt",
              categories: ["agents"],
              publishedAt: "2026-04-04T12:00:00.000Z",
            },
          ],
          feeds: [],
          fetchedAt: "2026-04-06T00:00:00.000Z",
          expiresAt: "2026-04-06T00:10:00.000Z",
          cacheState: "live",
          totalSources: 1,
          successfulSources: 1,
          failedSources: 0,
          next_cursor: 2,
        }),
      )
      .mockResolvedValueOnce(
        makeResponse({
          posts: [
            {
              id: "post-3",
              feedId: "feed-1",
              feedTitle: "Agent Feed",
              sourceUrl: "https://example.com/feed-1",
              title: "Agent scaling stories",
              link: "https://example.com/post-3",
              summary: "Second page",
              author: "Wyatt",
              categories: ["agents"],
              publishedAt: "2026-04-03T12:00:00.000Z",
            },
          ],
          feeds: [],
          fetchedAt: "2026-04-06T00:00:00.000Z",
          expiresAt: "2026-04-06T00:10:00.000Z",
          cacheState: "live",
          totalSources: 1,
          successfulSources: 1,
          failedSources: 0,
          next_cursor: null,
        }),
      )
      .mockResolvedValueOnce(
        makeResponse({
          posts: [
            {
              id: "post-4",
              feedId: "feed-2",
              feedTitle: "ML Digest",
              sourceUrl: "https://example.com/feed-2",
              title: "Different scope article",
              link: "https://example.com/post-4",
              summary: "Scope reset",
              author: "Ada",
              categories: ["ml"],
              publishedAt: "2026-04-02T12:00:00.000Z",
            },
          ],
          feeds: [],
          fetchedAt: "2026-04-06T00:00:00.000Z",
          expiresAt: "2026-04-06T00:10:00.000Z",
          cacheState: "live",
          totalSources: 1,
          successfulSources: 1,
          failedSources: 0,
          next_cursor: null,
        }),
      );

    const { result, rerender } = renderHook(
      ({ feedIds }) =>
        useReaderTimeline(feedIds, {
          enabled: true,
          limit: 2,
          perFeedLimit: 8,
          stream: "all",
          cursor: 0,
        }),
      {
        initialProps: { feedIds: ["feed-1"] as string[] },
        reactStrictMode: false,
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.articles).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.articles).toHaveLength(3);
    expect(result.current.hasMore).toBe(false);

    rerender({ feedIds: ["feed-2"] });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.articles).toHaveLength(1);
    expect(result.current.articles[0]?.feedId).toBe("feed-2");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("feed=feed-1");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("cursor=2");
    expect(fetchMock.mock.calls[2]?.[0]).toContain("feed=feed-2");
  });
});
