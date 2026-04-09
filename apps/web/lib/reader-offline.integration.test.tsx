import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Annotation, Article, Preferences, SyncQueueItem } from "@/lib/db";
import type { NormalizedArticle, TimelineResult } from "@/lib/reader-types";
import {
  detectArticleStateConflict,
  listArticleAnnotations,
  setArticleState,
} from "@/lib/reader-local-state";
import { useArticleState } from "@/lib/use-reader-article-state";
import { useReaderTimeline } from "@/lib/use-reader-timeline";

const mockArticles = new Map<string, Article>();
const mockAnnotations = new Map<string, Annotation>();
const mockSyncQueue = new Map<string, SyncQueueItem>();
const fetchTimelineMock = vi.fn();

const DEFAULT_PREFERENCES: Preferences = {
  id: "user_prefs",
  theme: "system",
  fontSize: 16,
  fontFamily: "system-ui",
  readingWidth: "medium",
  layout: "cards",
  showImages: true,
  showSummaries: true,
  markAsReadOnScroll: false,
  keyboardShortcuts: {},
  offlineMode: false,
  syncOnStartup: true,
  updatedAt: 0,
};

vi.mock("@/lib/db", () => ({
  articles: {
    get: vi.fn(async (id: string) => mockArticles.get(id)),
    put: vi.fn(async (article: unknown) => {
      const next = article as Article;
      mockArticles.set(next.id, next);
    }),
  },
  annotations: {
    get: vi.fn(async (id: string) => mockAnnotations.get(id)),
    put: vi.fn(async (annotation: unknown) => {
      const next = annotation as Annotation;
      mockAnnotations.set(next.id, next);
    }),
    delete: vi.fn(async (id: string) => {
      mockAnnotations.delete(id);
    }),
    getByArticle: vi.fn(async (articleId: string) =>
      Array.from(mockAnnotations.values()).filter(
        (annotation) => annotation.articleId === articleId,
      ),
    ),
  },
  syncQueue: {
    put: vi.fn(async (item: unknown) => {
      const next = item as SyncQueueItem;
      mockSyncQueue.set(next.id, next);
    }),
    getPending: vi.fn(async () =>
      Array.from(mockSyncQueue.values()).filter((item) => !item.synced),
    ),
  },
  preferences: {
    get: vi.fn(async () => DEFAULT_PREFERENCES),
    put: vi.fn(async () => undefined),
    update: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/reader-service", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/reader-service")>("@/lib/reader-service");
  return {
    ...actual,
    fetchTimeline: (...args: unknown[]) => fetchTimelineMock(...args),
  };
});

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

function makeTimelineResult(article: NormalizedArticle): TimelineResult {
  return {
    articles: [article],
    fetchedAt: new Date(0).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    cacheState: "live",
    totalSources: 1,
    successfulSources: 1,
    failedSources: 0,
  };
}

function OfflineReaderProbe() {
  const { articles, loading } = useReaderTimeline(["feed-1"]);
  const activeArticle = articles[0];
  const { state, toggleStar } = useArticleState(activeArticle?.id ?? "", activeArticle);

  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="timeline-starred">{String(activeArticle?.starred ?? false)}</div>
      <div data-testid="local-starred">{String(state.starred)}</div>
      <button disabled={!activeArticle} onClick={() => void toggleStar()}>
        toggle star
      </button>
    </div>
  );
}

beforeEach(() => {
  mockArticles.clear();
  mockAnnotations.clear();
  mockSyncQueue.clear();
  fetchTimelineMock.mockReset();
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("offline reader flows", () => {
  it("queues offline article mutations and reflects them across the loaded timeline", async () => {
    fetchTimelineMock.mockResolvedValue(makeTimelineResult(makeArticle()));

    render(<OfflineReaderProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("timeline-starred")).toHaveTextContent("false");
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "toggle star" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("timeline-starred")).toHaveTextContent("true");
      expect(screen.getByTestId("local-starred")).toHaveTextContent("true");
    });

    expect(mockArticles.get("article-1")?.starred).toBe(true);
    expect(mockSyncQueue.get("reader:article-1:star")).toEqual(
      expect.objectContaining({
        type: "star",
        articleId: "article-1",
        synced: false,
      }),
    );
  });

  it("marks missing remote articles as conflicts and records durable annotations", async () => {
    await setArticleState("ghost-article", { archived: true });

    const conflict = await detectArticleStateConflict("ghost-article", null);
    const annotations = await listArticleAnnotations("ghost-article");

    expect(conflict).toEqual(
      expect.objectContaining({
        articleId: "ghost-article",
        reason: "missing_remote_article",
        localState: expect.objectContaining({ archived: true }),
      }),
    );
    expect(annotations).toEqual([
      expect.objectContaining({
        id: "conflict:ghost-article",
        type: "note",
      }),
    ]);
    expect(mockSyncQueue.get("reader:ghost-article:archive")?.type).toBe("archive");
    expect(mockSyncQueue.get("annotation:conflict:ghost-article")?.type).toBe("annotation");
  });
});
