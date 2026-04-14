import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replaceMock, useSearchParamsMock, useArticleStateMock, useReaderPreferencesMock } =
  vi.hoisted(() => ({
    replaceMock: vi.fn(),
    useSearchParamsMock: vi.fn(() => new URLSearchParams()),
    useArticleStateMock: vi.fn(),
    useReaderPreferencesMock: vi.fn(),
  }));

let currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/feeds",
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => useSearchParamsMock(),
}));

vi.mock("@/lib/use-reader-article-state", () => ({
  useArticleState: (...args: unknown[]) => useArticleStateMock(...args),
}));

vi.mock("@/lib/use-reader-preferences", () => ({
  useReaderPreferences: () => useReaderPreferencesMock(),
}));

import { FeedsWorkspaceClient } from "./feeds-workspace-client";

const feeds = [
  {
    id: "feed-1",
    title: "Agent Feed",
    description: "Agent systems coverage",
    url: "https://example.com/feed-1.xml",
    website_url: "https://example.com/feed-1",
    source_type: "blog",
    topics: ["agents"],
    verified: true,
    is_active: true,
  },
  {
    id: "feed-2",
    title: "ML Digest",
    description: "Machine learning notes",
    url: "https://example.com/feed-2.xml",
    website_url: "https://example.com/feed-2",
    source_type: "newsletter",
    topics: ["ml"],
    verified: false,
    is_active: true,
  },
];

const initialBrowse = {
  items: [
    {
      id: "article-1",
      feed_id: "feed-1",
      feed_title: "Agent Feed",
      title: "Agent systems roundup",
      link: "https://example.com/article-1",
      summary: "Fresh research notes",
      content_html: "<p>Fresh research notes</p>",
      author: "Wyatt",
      published_at: "2026-04-05T12:00:00.000Z",
      categories: ["agents"],
      topics: ["agents"],
      source_type: "blog",
      verified: true,
      is_active: true,
    },
  ],
  next_cursor: null,
  total_matched: 1,
  cursor: 0,
  limit: 24,
  applied_query: null,
  applied_sort: "latest",
  corpus: {
    generated_at: "2026-04-12T00:00:00.000Z",
    source_db: "data/ai-web-feeds.db",
    article_count: 1,
    feed_count: 1,
    latest_published_at: "2026-04-05T12:00:00.000Z",
    is_empty: false,
  },
};

const initialState = {
  query: "agents",
  feedIds: ["feed-1"],
  sourceType: "blog",
  topics: ["agents"],
  verified: true,
  sort: "latest",
  readerView: "latest",
  cursor: 0,
  limit: 24,
};

function makeResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe("FeedsWorkspaceClient", () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams(
      "q=agents&source_type=blog&verified=true&feed=feed-1",
    );
    useSearchParamsMock.mockImplementation(() => currentSearchParams);
    replaceMock.mockReset();
    useArticleStateMock.mockReset();
    useReaderPreferencesMock.mockReset();
    if (typeof window.localStorage?.clear === "function") {
      window.localStorage.clear();
    }

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
      update: vi.fn(async () => undefined),
    });

    useArticleStateMock.mockImplementation(
      (
        _articleId: string,
        article?: { read?: boolean; starred?: boolean; archived?: boolean; bookmarked?: boolean },
      ) => ({
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
      }),
    );
  });

  it("renders the feeds workspace from the seeded browse snapshot", () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => initialBrowse,
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <FeedsWorkspaceClient
        mode="reader"
        feeds={feeds}
        stats={{
          total: 2,
          sourceTypeCount: 2,
          topicCount: 2,
          verified: 1,
          active: 2,
          hasVerificationMetadata: true,
          hasActivityMetadata: true,
        }}
        initialState={initialState}
        initialBrowse={initialBrowse as never}
      />,
    );

    expect(screen.getByRole("heading", { name: "Read and filter your feeds" })).toBeInTheDocument();
    expect(screen.getAllByText("Agent systems roundup").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fresh research notes").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Refresh latest/i })).toBeInTheDocument();
  });

  it("layers live overlay items on refresh and marks them fresh", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/feeds/posts/aggregate")) {
        return makeResponse({
          posts: [
            {
              id: "article-1",
              feedId: "feed-1",
              feedTitle: "Agent Feed",
              title: "Agent systems roundup",
              link: "https://example.com/article-1",
              summary: "Fresh research notes",
              sourceUrl: "https://example.com/feed-1",
              author: "Wyatt",
              publishedAt: "2026-04-05T12:00:00.000Z",
              categories: ["agents"],
            },
            {
              id: "article-2",
              feedId: "feed-2",
              feedTitle: "ML Digest",
              title: "Fresh model notes",
              link: "https://example.com/article-2",
              summary: "New live post",
              sourceUrl: "https://example.com/feed-2",
              author: "Mina",
              publishedAt: "2026-04-06T12:00:00.000Z",
              categories: ["ml"],
            },
          ],
          fetchedAt: "2026-04-13T12:00:00.000Z",
        });
      }

      return makeResponse({}, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <FeedsWorkspaceClient
        mode="reader"
        feeds={feeds}
        stats={{
          total: 2,
          sourceTypeCount: 2,
          topicCount: 2,
          verified: 1,
          active: 2,
          hasVerificationMetadata: true,
          hasActivityMetadata: true,
        }}
        initialState={initialState}
        initialBrowse={initialBrowse as never}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Refresh latest/i }));

    await waitFor(() => {
      expect(screen.getByText("Fresh model notes")).toBeInTheDocument();
    });
    expect(screen.getByText("Fresh model notes")).toBeInTheDocument();
    expect(screen.getAllByText("New").length).toBeGreaterThan(0);
  });

  it("sanitizes preview html while preserving safe rich markup", () => {
    const maliciousBrowse = {
      ...initialBrowse,
      items: [
        {
          ...initialBrowse.items[0],
          content_html: [
            '<p style="color:red" onclick="alert(1)">Safe preview <a href="/source" onclick="evil()">link</a></p>',
            '<script>alert("bad")</script>',
            '<iframe src="https://evil.example/embed"></iframe>',
            '<form action="/submit"><button>Do not render form</button></form>',
            '<img src="/cover.png" alt="Preview cover" onerror="evil()">',
            "<table><tbody><tr><td>Agents</td></tr></tbody></table>",
            "<pre><code>const ok = true;</code></pre>",
          ].join(""),
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => makeResponse(maliciousBrowse)),
    );

    const { container } = render(
      <FeedsWorkspaceClient
        mode="reader"
        feeds={feeds}
        stats={{
          total: 2,
          sourceTypeCount: 2,
          topicCount: 2,
          verified: 1,
          active: 2,
          hasVerificationMetadata: true,
          hasActivityMetadata: true,
        }}
        initialState={initialState}
        initialBrowse={maliciousBrowse as never}
      />,
    );

    const previewLink = screen.getByRole("link", { name: "link" });
    expect(previewLink).toHaveAttribute("href", "https://example.com/source");
    expect(previewLink).toHaveAttribute("target", "_blank");
    expect(previewLink).toHaveAttribute("rel", "noreferrer noopener");

    const previewImage = screen.getByRole("img", { name: "Preview cover" });
    expect(previewImage).toHaveAttribute("src", "https://example.com/cover.png");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelector("pre code")).not.toBeNull();
    expect(container).not.toHaveTextContent("Do not render form");
  });

  it("shows a dedicated article-library unavailable state when the article load fails", async () => {
    const fetchMock = vi.fn(async () => makeResponse({}, false, 503));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <FeedsWorkspaceClient
        mode="reader"
        feeds={feeds}
        stats={{
          total: 2,
          sourceTypeCount: 2,
          topicCount: 2,
          verified: 1,
          active: 2,
          hasVerificationMetadata: true,
          hasActivityMetadata: true,
        }}
        initialState={initialState}
        initialBrowse={null}
      />,
    );

    expect(await screen.findByText("Article library unavailable")).toBeInTheDocument();
    expect(screen.getByText(/The article library has not been built yet/)).toBeInTheDocument();
  });

  it("adds recovery links when the current filters return no visible posts", async () => {
    currentSearchParams = new URLSearchParams(
      "q=missing&source_type=blog&verified=true&feed=feed-1&reader_view=archived",
    );
    useSearchParamsMock.mockImplementation(() => currentSearchParams);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        makeResponse({
          ...initialBrowse,
          items: [],
          total_matched: 0,
          applied_query: "missing",
        }),
      ),
    );

    render(
      <FeedsWorkspaceClient
        mode="reader"
        feeds={feeds}
        stats={{
          total: 2,
          sourceTypeCount: 2,
          topicCount: 2,
          verified: 1,
          active: 2,
          hasVerificationMetadata: true,
          hasActivityMetadata: true,
        }}
        initialState={{
          ...initialState,
          query: "missing",
          readerView: "archived",
        }}
        initialBrowse={
          {
            ...initialBrowse,
            items: [],
            total_matched: 0,
            applied_query: "missing",
          } as never
        }
      />,
    );

    expect(await screen.findByText("No posts match these filters")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear post filters" })).toHaveAttribute(
      "href",
      "/feeds?source_type=blog&verified=true&feed=feed-1",
    );
    expect(screen.getByRole("link", { name: "Reset filters" })).toHaveAttribute("href", "/feeds");
    expect(screen.getByRole("link", { name: "Open catalog" })).toHaveAttribute(
      "href",
      "/feeds?source_type=blog&verified=true&feed=feed-1&mode=catalog",
    );
  });

  it("keeps catalog mode as the explicit source picker", () => {
    vi.stubGlobal("fetch", vi.fn());
    currentSearchParams = new URLSearchParams();
    useSearchParamsMock.mockImplementation(() => currentSearchParams);

    render(
      <FeedsWorkspaceClient
        mode="catalog"
        feeds={feeds}
        stats={{
          total: 2,
          sourceTypeCount: 2,
          topicCount: 2,
          verified: 1,
          active: 2,
          hasVerificationMetadata: true,
          hasActivityMetadata: true,
        }}
        initialState={initialState}
        initialBrowse={null}
      />,
    );

    expect(screen.getByRole("heading", { name: "Narrow the catalog" })).toBeInTheDocument();
    expect(screen.getByText("Agent Feed")).toBeInTheDocument();
    expect(screen.getByText("ML Digest")).toBeInTheDocument();
  });
});
