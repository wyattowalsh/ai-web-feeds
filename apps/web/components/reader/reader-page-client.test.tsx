import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedArticle } from "@/lib/reader-types";

const {
  loadMoreMock,
  refreshMock,
  replaceMock,
  updatePreferencesMock,
  useArticleStateMock,
  useReaderPreferencesMock,
  useReaderTimelineMock,
  useSearchParamsMock,
} = vi.hoisted(() => ({
  loadMoreMock: vi.fn(),
  refreshMock: vi.fn(),
  replaceMock: vi.fn(),
  updatePreferencesMock: vi.fn(async () => undefined),
  useArticleStateMock: vi.fn(),
  useReaderPreferencesMock: vi.fn(),
  useReaderTimelineMock: vi.fn(),
  useSearchParamsMock: vi.fn(() => new URLSearchParams()),
}));

let currentSearchParams = new URLSearchParams();
let currentPathname = "/reader";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => useSearchParamsMock(),
}));

vi.mock("@/lib/use-reader-timeline", () => ({
  useReaderTimeline: (...args: unknown[]) => useReaderTimelineMock(...args),
}));

vi.mock("@/lib/use-reader-preferences", () => ({
  useReaderPreferences: () => useReaderPreferencesMock(),
}));

vi.mock("@/lib/use-reader-article-state", () => ({
  useArticleState: (...args: unknown[]) => useArticleStateMock(...args),
}));

import { ReaderPageClient } from "./reader-page-client";

function makeArticle(overrides: Partial<NormalizedArticle> = {}): NormalizedArticle {
  return {
    id: "article-1",
    feedId: "feed-1",
    feedTitle: "Agent Feed",
    sourceUrl: "https://example.com/feed",
    title: "Agent systems roundup",
    link: "https://example.com/article-1",
    summary: "Fresh research notes",
    author: "Wyatt",
    categories: ["agents"],
    publishedAt: "2026-04-05T12:00:00.000Z",
    publishedAtMs: Date.parse("2026-04-05T12:00:00.000Z"),
    read: false,
    starred: false,
    archived: false,
    bookmarked: false,
    ...overrides,
  };
}

const feeds = [
  {
    id: "feed-1",
    title: "Agent Feed",
    sourceType: "blog",
    topics: ["agents"],
    verified: true,
    isActive: true,
    url: "https://example.com/feed-1",
  },
  {
    id: "feed-2",
    title: "ML Digest",
    sourceType: "newsletter",
    topics: ["ml"],
    verified: false,
    isActive: true,
    url: "https://example.com/feed-2",
  },
  {
    id: "feed-3",
    title: "Inactive Feed",
    sourceType: "podcast",
    topics: ["agents"],
    verified: false,
    isActive: false,
    url: "https://example.com/feed-3",
  },
];

describe("ReaderPageClient", () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams();
    currentPathname = "/reader";
    useSearchParamsMock.mockImplementation(() => currentSearchParams);

    replaceMock.mockReset();
    replaceMock.mockImplementation((url: string) => {
      const parsed = new URL(url, "https://aiwebfeeds.test");
      currentSearchParams = new URLSearchParams(parsed.search);
      useSearchParamsMock.mockImplementation(() => currentSearchParams);
    });

    refreshMock.mockReset();
    updatePreferencesMock.mockReset();
    useReaderTimelineMock.mockReset();
    useReaderPreferencesMock.mockReset();
    useArticleStateMock.mockReset();

    useReaderTimelineMock.mockReturnValue({
      articles: [makeArticle()],
      meta: {
        cacheState: "live",
        fetchedAt: "2026-04-06T00:00:00.000Z",
        expiresAt: "2026-04-06T00:10:00.000Z",
        totalSources: 1,
        successfulSources: 1,
        failedSources: 0,
      },
      loading: false,
      loadingMore: false,
      error: null,
      hasMore: false,
      loadMore: loadMoreMock,
      refresh: refreshMock,
    });

    useReaderPreferencesMock.mockReturnValue({
      preferences: {
        layout: "cards",
        theme: "system",
        fontSize: 16,
        fontFamily: "system-ui",
        readingWidth: "medium",
        showImages: true,
        showSummaries: true,
        markAsReadOnScroll: false,
      },
      loading: false,
      update: updatePreferencesMock,
    });

    useArticleStateMock.mockImplementation((_articleId: string, article?: NormalizedArticle) => ({
      state: {
        read: article?.read ?? false,
        starred: article?.starred ?? false,
        archived: article?.archived ?? false,
        bookmarked: article?.bookmarked ?? false,
      },
      loading: false,
      markRead: vi.fn(async () => undefined),
      markUnread: vi.fn(async () => undefined),
      toggleStar: vi.fn(async () => undefined),
      toggleArchive: vi.fn(async () => undefined),
      toggleBookmark: vi.fn(async () => undefined),
    }));
  });

  it("honors /feeds workspace filters and reader-specific query state", () => {
    currentPathname = "/feeds";
    currentSearchParams = new URLSearchParams(
      "source_type=blog&topics=agents&verified=true&q=roundup&reader_view=bookmarked&reader_sort=source&stream=all&cursor=24",
    );
    useSearchParamsMock.mockImplementation(() => currentSearchParams);

    useReaderTimelineMock.mockReturnValue({
      articles: [makeArticle({ id: "saved-1", bookmarked: true, title: "Agent systems roundup" })],
      meta: {
        cacheState: "cached",
        fetchedAt: "2026-04-06T00:00:00.000Z",
        expiresAt: "2026-04-06T00:10:00.000Z",
        totalSources: 1,
        successfulSources: 1,
        failedSources: 0,
      },
      loading: false,
      loadingMore: false,
      error: null,
      hasMore: true,
      loadMore: loadMoreMock,
      refresh: refreshMock,
    });

    render(<ReaderPageClient feeds={feeds} />);

    expect(useReaderTimelineMock).toHaveBeenCalledWith(
      ["feed-1"],
      expect.objectContaining({
        enabled: true,
        limit: 24,
        perFeedLimit: 8,
        stream: "all",
        cursor: 24,
      }),
    );
    expect(screen.getByText("Agent systems roundup")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reader stream" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Catalog" })).toHaveAttribute(
      "href",
      "/feeds?source_type=blog&topics=agents&verified=true&q=roundup&reader_view=bookmarked&reader_sort=source&stream=all&cursor=24",
    );
    expect(screen.getByRole("link", { name: "Articles" })).toHaveAttribute(
      "href",
      "/feeds?source_type=blog&topics=agents&verified=true&q=roundup&reader_view=bookmarked&reader_sort=source&stream=all&cursor=24&mode=articles",
    );

    fireEvent.change(screen.getByLabelText("Sort"), {
      target: { value: "oldest" },
    });
    expect(replaceMock).toHaveBeenLastCalledWith(
      "/feeds?source_type=blog&topics=agents&verified=true&q=roundup&reader_view=bookmarked&reader_sort=oldest&stream=all&cursor=24",
      { scroll: false },
    );
  });

  it("updates URL params for feed, query, and sort changes", () => {
    render(<ReaderPageClient feeds={feeds} />);

    fireEvent.change(screen.getByLabelText("Feed"), {
      target: { value: "feed-2" },
    });
    expect(replaceMock).toHaveBeenLastCalledWith("/feeds?feed=feed-2", { scroll: false });

    fireEvent.change(screen.getByLabelText("Filter visible articles"), {
      target: { value: "newsletter" },
    });
    expect(replaceMock).toHaveBeenLastCalledWith("/feeds?feed=feed-2&q=newsletter", {
      scroll: false,
    });

    fireEvent.change(screen.getByLabelText("Sort"), {
      target: { value: "source" },
    });
    expect(replaceMock).toHaveBeenLastCalledWith("/feeds?feed=feed-2&q=newsletter&sort=source", {
      scroll: false,
    });

    fireEvent.change(screen.getByLabelText("Stream"), {
      target: { value: "all" },
    });
    expect(replaceMock).toHaveBeenLastCalledWith(
      "/feeds?feed=feed-2&q=newsletter&sort=source&stream=all",
      { scroll: false },
    );
  });

  it("keeps the embedded /feeds surface compact and canonical", () => {
    currentPathname = "/feeds";
    currentSearchParams = new URLSearchParams("feed=feed-1&source_type=blog&q=roundup");
    useSearchParamsMock.mockImplementation(() => currentSearchParams);

    render(<ReaderPageClient feeds={feeds} />);

    expect(
      screen.queryByText("Read the latest posts from the AI source registry."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Catalog" })).toHaveAttribute(
      "href",
      "/feeds?feed=feed-1&source_type=blog&q=roundup",
    );
    expect(screen.getByRole("link", { name: "Articles" })).toHaveAttribute(
      "href",
      "/feeds?feed=feed-1&source_type=blog&q=roundup&mode=articles",
    );
  });

  it("treats repeated feed params as an explicit workspace slice", () => {
    currentPathname = "/feeds";
    currentSearchParams = new URLSearchParams("feed=feed-1&feed=feed-2&mode=reader");
    useSearchParamsMock.mockImplementation(() => currentSearchParams);

    render(<ReaderPageClient feeds={feeds} />);

    expect(useReaderTimelineMock).toHaveBeenCalledWith(
      ["feed-1", "feed-2"],
      expect.objectContaining({
        enabled: true,
        limit: 48,
        perFeedLimit: 3,
        stream: "sample",
        cursor: 0,
      }),
    );
    expect(
      screen.getByText("Pinned to 2 feeds carried over from the current catalog filters."),
    ).toBeInTheDocument();
  });

  it("uses selected-feed mode to fetch the latest 8 posts from a single feed", () => {
    currentSearchParams = new URLSearchParams("feed=feed-2");
    useSearchParamsMock.mockImplementation(() => currentSearchParams);

    render(<ReaderPageClient feeds={feeds} />);

    expect(useReaderTimelineMock).toHaveBeenCalledWith(
      ["feed-2"],
      expect.objectContaining({
        enabled: true,
        limit: 8,
        perFeedLimit: 8,
        stream: "sample",
        cursor: 0,
      }),
    );
    expect(
      screen.getByText(
        (_, element) => element?.textContent === "Focused on one feed, up to 8 recent posts",
      ),
    ).toBeInTheDocument();
  });

  it("discloses exact scanned-versus-matching counts when broad mode is truncated", () => {
    const manyFeeds = Array.from({ length: 20 }, (_, index) => ({
      id: `feed-${index + 1}`,
      title: `Feed ${index + 1}`,
      sourceType: "blog",
      topics: ["agents"],
      verified: index % 2 === 0,
      isActive: true,
      url: `https://example.com/feed-${index + 1}`,
    }));

    render(<ReaderPageClient feeds={manyFeeds} />);

    expect(
      screen.getByText(
        (_, element) =>
          element?.textContent?.replace(/\s+/g, " ").trim() ===
          "Showing 1 visible article from 18 scanned feeds",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) =>
          element?.textContent?.replace(/\s+/g, " ").trim() ===
          "Truncated broad mode: scanning 18 of 20 matching feeds, up to 3 posts per source.",
      ),
    ).toBeInTheDocument();
  });

  it("renders a manual load-more fallback when the full stream has another page", () => {
    currentSearchParams = new URLSearchParams("stream=all");
    useSearchParamsMock.mockImplementation(() => currentSearchParams);

    useReaderTimelineMock.mockReturnValue({
      articles: [makeArticle()],
      meta: {
        cacheState: "live",
        fetchedAt: "2026-04-06T00:00:00.000Z",
        expiresAt: "2026-04-06T00:10:00.000Z",
        totalSources: 1,
        successfulSources: 1,
        failedSources: 0,
      },
      loading: false,
      loadingMore: false,
      error: null,
      hasMore: true,
      loadMore: loadMoreMock,
      refresh: refreshMock,
    });

    render(<ReaderPageClient feeds={feeds} />);

    fireEvent.click(screen.getByRole("button", { name: "Load more posts" }));
    expect(loadMoreMock).toHaveBeenCalledTimes(1);
  });

  it("wires local article-state interactions through the existing hook", async () => {
    const markRead = vi.fn(async () => undefined);
    const toggleStar = vi.fn(async () => undefined);
    const toggleBookmark = vi.fn(async () => undefined);
    const toggleArchive = vi.fn(async () => undefined);

    useArticleStateMock.mockReturnValue({
      state: {
        read: false,
        starred: false,
        archived: false,
        bookmarked: false,
      },
      loading: false,
      markRead,
      markUnread: vi.fn(async () => undefined),
      toggleStar,
      toggleArchive,
      toggleBookmark,
    });

    render(<ReaderPageClient feeds={feeds} />);

    fireEvent.click(screen.getByTitle("Mark as read"));
    fireEvent.click(screen.getByTitle("Star"));
    fireEvent.click(screen.getByTitle("Bookmark"));
    fireEvent.click(screen.getByTitle("Archive"));

    expect(markRead).toHaveBeenCalledTimes(1);
    expect(toggleStar).toHaveBeenCalledTimes(1);
    expect(toggleBookmark).toHaveBeenCalledTimes(1);
    expect(toggleArchive).toHaveBeenCalledTimes(1);
  });
});
