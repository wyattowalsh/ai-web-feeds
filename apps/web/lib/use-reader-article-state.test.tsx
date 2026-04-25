import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LocalArticleState, NormalizedArticle } from "@/lib/reader-types";

const getOrDefaultArticleStateMock = vi.fn();
const markReadMock = vi.fn();
const markUnreadMock = vi.fn();
const toggleStarMock = vi.fn();
const toggleArchiveMock = vi.fn();
const toggleBookmarkMock = vi.fn();

let localStateSubscription:
  | ((detail: { articleId: string; state: LocalArticleState; lastModified: number }) => void)
  | null = null;

vi.mock("@/lib/reader-local-state", () => ({
  getOrDefaultArticleState: (...args: [string]) => getOrDefaultArticleStateMock(...args),
  markRead: (...args: [string, NormalizedArticle | undefined]) => markReadMock(...args),
  markUnread: (...args: [string, NormalizedArticle | undefined]) => markUnreadMock(...args),
  toggleStar: (...args: [string, NormalizedArticle | undefined]) => toggleStarMock(...args),
  toggleArchive: (...args: [string, NormalizedArticle | undefined]) => toggleArchiveMock(...args),
  toggleBookmark: (...args: [string, NormalizedArticle | undefined]) => toggleBookmarkMock(...args),
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

import { useArticleState } from "@/lib/use-reader-article-state";

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

beforeEach(() => {
  getOrDefaultArticleStateMock.mockReset();
  markReadMock.mockReset();
  markUnreadMock.mockReset();
  toggleStarMock.mockReset();
  toggleArchiveMock.mockReset();
  toggleBookmarkMock.mockReset();
  localStateSubscription = null;

  getOrDefaultArticleStateMock.mockResolvedValue({
    read: false,
    starred: false,
    archived: false,
    bookmarked: false,
  });
  markReadMock.mockResolvedValue();
  markUnreadMock.mockResolvedValue();
  toggleStarMock.mockResolvedValue(true);
  toggleArchiveMock.mockResolvedValue(true);
  toggleBookmarkMock.mockResolvedValue(true);
});

describe("useArticleState", () => {
  it("waits for the local-state event before updating mutation state", async () => {
    const article = makeArticle();
    const { result } = renderHook(() => useArticleState(article.id, article));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.state.starred).toBe(false);

    await act(async () => {
      await result.current.toggleStar();
    });

    expect(toggleStarMock).toHaveBeenCalledWith(article.id, article);
    expect(result.current.state.starred).toBe(false);

    act(() => {
      localStateSubscription?.({
        articleId: article.id,
        state: {
          read: false,
          starred: true,
          archived: false,
          bookmarked: false,
        },
        lastModified: 123,
      });
    });

    expect(result.current.state.starred).toBe(true);
  });
});
