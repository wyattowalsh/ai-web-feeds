import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LocalArticleState, NormalizedArticle, TimelineResult } from "@/lib/reader-types";

const fetchTimelineMock = vi.fn();
const enrichArticlesWithLocalStateMock = vi.fn(async (articles: NormalizedArticle[]) => articles);
let localStateSubscription:
  | ((detail: { articleId: string; state: LocalArticleState; lastModified: number }) => void)
  | null = null;

vi.mock("@/lib/reader-service", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/reader-service")>("@/lib/reader-service");
  return {
    ...actual,
    fetchTimeline: (...args: unknown[]) => fetchTimelineMock(...args),
  };
});

vi.mock("@/lib/reader-local-state", () => ({
  enrichArticlesWithLocalState: (...args: [NormalizedArticle[]]) =>
    enrichArticlesWithLocalStateMock(...args),
  subscribeToReaderLocalState: vi.fn(
    (
      handler: (detail: {
        articleId: string;
        state: LocalArticleState;
        lastModified: number;
      }) => void,
    ) => {
      localStateSubscription = handler;
      return () => {
        localStateSubscription = null;
      };
    },
  ),
}));

import { useReaderTimeline } from "@/lib/use-reader-timeline";

function makeArticle(overrides: Partial<NormalizedArticle> = {}): NormalizedArticle {
  return {
    id: "article-1",
    feedId: "feed-1",
    feedTitle: "Feed One",
    sourceUrl: "https://example.com",
    title: "Article One",
    link: "https://example.com/article-1",
    summary: null,
    author: null,
    categories: [],
    publishedAt: "2025-01-01T00:00:00Z",
    publishedAtMs: new Date("2025-01-01T00:00:00Z").getTime(),
    read: false,
    starred: false,
    archived: false,
    bookmarked: false,
    ...overrides,
  };
}

function makeTimelineResult(
  articles: NormalizedArticle[],
  expiresAt: string,
  cacheState: TimelineResult["cacheState"] = "live",
): TimelineResult {
  return {
    articles,
    fetchedAt: new Date(0).toISOString(),
    expiresAt,
    cacheState,
    totalSources: 1,
    successfulSources: 1,
    failedSources: 0,
  };
}

function Probe() {
  const { articles, loading, meta } = useReaderTimeline(["feed-1"]);

  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="cache-state">{meta?.cacheState ?? "none"}</div>
      <div data-testid="article-order">{articles.map((article) => article.id).join(",")}</div>
      <div data-testid="article-starred">{String(articles[0]?.starred ?? false)}</div>
      <div data-testid="article-read">{String(articles[0]?.read ?? false)}</div>
    </div>
  );
}

function ForceRefreshProbe() {
  useReaderTimeline(["feed-1"], { forceRefresh: true });
  return null;
}

beforeEach(() => {
  fetchTimelineMock.mockReset();
  enrichArticlesWithLocalStateMock.mockClear();
  localStateSubscription = null;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useReaderTimeline", () => {
  it("sorts the timeline and refreshes when the cached payload expires", async () => {
    fetchTimelineMock
      .mockResolvedValueOnce(
        makeTimelineResult(
          [
            makeArticle({
              id: "older",
              title: "Older",
              publishedAt: "2024-12-31T23:59:00Z",
              publishedAtMs: new Date("2024-12-31T23:59:00Z").getTime(),
            }),
            makeArticle({
              id: "newer",
              title: "Newer",
              publishedAt: "2025-01-01T00:00:30Z",
              publishedAtMs: new Date("2025-01-01T00:00:30Z").getTime(),
            }),
          ],
          new Date("2025-01-01T00:00:01Z").toISOString(),
        ),
      )
      .mockResolvedValueOnce(
        makeTimelineResult(
          [makeArticle({ id: "refreshed", title: "Refreshed" })],
          new Date("2025-01-01T00:10:00Z").toISOString(),
        ),
      );

    await act(async () => {
      render(<Probe />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("article-order")).toHaveTextContent("newer,older");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchTimelineMock).toHaveBeenCalledTimes(2);
    expect(fetchTimelineMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        forceRefresh: true,
      }),
    );
    expect(screen.getByTestId("article-order")).toHaveTextContent("refreshed");
  });

  it("patches in-place article state updates without refetching the timeline", async () => {
    fetchTimelineMock.mockResolvedValue(
      makeTimelineResult(
        [makeArticle({ id: "article-1" })],
        new Date("2025-01-01T00:10:00Z").toISOString(),
      ),
    );

    await act(async () => {
      render(<Probe />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("article-starred")).toHaveTextContent("false");

    act(() => {
      localStateSubscription?.({
        articleId: "article-1",
        state: {
          read: true,
          starred: true,
          archived: false,
          bookmarked: false,
        },
        lastModified: 123,
      });
    });

    expect(fetchTimelineMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("article-starred")).toHaveTextContent("true");
    expect(screen.getByTestId("article-read")).toHaveTextContent("true");
  });

  it("honors forceRefresh on the initial load", async () => {
    fetchTimelineMock.mockResolvedValue(
      makeTimelineResult(
        [makeArticle({ id: "article-1" })],
        new Date("2025-01-01T00:10:00Z").toISOString(),
      ),
    );

    await act(async () => {
      render(<ForceRefreshProbe />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchTimelineMock).toHaveBeenCalledWith(
      expect.objectContaining({
        forceRefresh: true,
      }),
    );
  });
});
