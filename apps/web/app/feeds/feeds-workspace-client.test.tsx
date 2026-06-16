import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replaceMock, useSearchParamsMock, useReaderPreferencesMock, localSearchMock } = vi.hoisted(
  () => ({
    replaceMock: vi.fn(),
    useSearchParamsMock: vi.fn(() => new URLSearchParams()),
    useReaderPreferencesMock: vi.fn(),
    localSearchMock: vi.fn(() => []),
  }),
);

let currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => useSearchParamsMock(),
}));

vi.mock("@/lib/use-reader-preferences", () => ({
  useReaderPreferences: () => useReaderPreferencesMock(),
}));

vi.mock("@/lib/reader/hydrate-article-state", () => ({
  hydrateArticleStates: vi.fn(async () => ({
    migratedCount: 0,
    clearedCount: 0,
    totalInIDB: 0,
  })),
  loadArticleStatesFromIDB: vi.fn(async () => ({})),
  syncArticleState: vi.fn(),
}));

vi.mock("@/hooks/use-reader-shortcuts", () => ({
  useReaderShortcuts: vi.fn(),
}));

vi.mock("@/hooks/use-local-search-index", () => ({
  useLocalSearchIndex: () => ({ ready: false, search: localSearchMock }),
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
      topics: ["agents"],
      source_topics: ["agents"],
      raw_categories: ["agents"],
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
    schema_version: "articles-3.0.0",
    generated_at: "2026-04-12T00:00:00.000Z",
    source_db: "data/ai-web-feeds.db",
    article_count: 1,
    feed_count: 1,
    latest_published_at: "2026-04-05T12:00:00.000Z",
    freshness_watermark: "2026-04-05T12:00:00.000Z",
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
  });

  it("renders the reader corpus workspace from the seeded browse snapshot", async () => {
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

    expect(
      screen.getByRole("heading", { name: "Read AI writing across the open web" }),
    ).toBeInTheDocument();
    expect((await screen.findAllByText("Agent systems roundup")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Fresh research notes")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Refresh latest/i })).toBeInTheDocument();
  });

  it("layers live overlay items on refresh and marks them fresh", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/feeds/posts/aggregate/stream")) {
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
              rawCategories: ["agents"],
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
              rawCategories: ["ml"],
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

  // pre-existing slow sanitization + rich markup render in jsdom; timeout increased to prevent flakiness on CI/local
  it("sanitizes preview html while preserving safe rich markup", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: "Preview" }));

    const previewLink = (await screen.findAllByRole("link", { name: "link" }))[0];
    expect(previewLink).toHaveAttribute("href", "https://example.com/source");
    expect(previewLink).toHaveAttribute("target", "_blank");
    expect(previewLink).toHaveAttribute("rel", "noreferrer noopener");

    const previewImage = (await screen.findAllByRole("img", { name: "Preview cover" }))[0];
    expect(previewImage).toHaveAttribute("src", "https://example.com/cover.png");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelector("pre code")).not.toBeNull();
    expect(container).not.toHaveTextContent("Do not render form");
  }, 15000);

  it("keeps preview closed until the user opens it and allows Escape to close it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => makeResponse(initialBrowse)),
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
        initialBrowse={initialBrowse as never}
      />,
    );

    expect(screen.queryByRole("button", { name: "Close preview" })).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Preview" }));
    expect(screen.getAllByRole("button", { name: "Close preview" }).length).toBeGreaterThan(0);
    expect(container.querySelector('[data-testid="reader-workspace-grid"]')).toHaveClass(
      "xl:grid-cols-[18rem_minmax(0,1fr)_22rem]",
    );

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Close preview" })).not.toBeInTheDocument();
    });
  });

  it("loads live posts from a bounded sample after an explicit corpus recovery action", async () => {
    currentSearchParams = new URLSearchParams();
    useSearchParamsMock.mockImplementation(() => currentSearchParams);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/feeds/posts/aggregate/stream")) {
        return makeResponse({
          posts: [
            {
              id: "live-1",
              feedId: "feed-2",
              feedTitle: "ML Digest",
              title: "Live model update",
              link: "https://example.com/live-1",
              summary: "Fetched from the live feed",
              sourceUrl: "https://example.com/feed-2",
              author: "Mina",
              publishedAt: "2026-04-06T12:00:00.000Z",
              rawCategories: ["ml"],
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
        initialState={{
          ...initialState,
          query: "",
          feedIds: [],
          sourceType: null,
          topics: [],
          verified: null,
        }}
        initialBrowse={null}
      />,
    );

    expect(screen.getByRole("heading", { name: "No prepared article corpus" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Load live sample" }));

    await waitFor(() => {
      expect(screen.getByText("Live model update")).toBeInTheDocument();
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/feeds/posts/aggregate/stream");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          feedIds: ["feed-1", "feed-2"],
          limit: 48,
          perFeedLimit: 3,
          refresh: true,
          q: null,
          sort: "latest",
        }),
      }),
    );
    expect(screen.getByText("Live mode")).toBeInTheDocument();
  });

  it("shows a live fetch recovery state when the snapshot is missing and feeds fail", async () => {
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

    expect(screen.getByRole("heading", { name: "No prepared article corpus" })).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some((call) => call[0] === "/api/feeds/posts/aggregate/stream"),
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Load live sample" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Live posts unavailable" })).toBeInTheDocument();
    });
    expect(screen.getByText("Could not fetch live posts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse sources" })).toHaveAttribute(
      "href",
      "/sources",
    );
  });

  it("applies draft filters explicitly and can reset them back to the primary reader route", () => {
    currentSearchParams = new URLSearchParams();
    useSearchParamsMock.mockImplementation(() => currentSearchParams);
    vi.stubGlobal("fetch", vi.fn());

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
          query: "",
          feedIds: [],
          sourceType: null,
          topics: [],
          verified: null,
        }}
        initialBrowse={initialBrowse as never}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Search posts" }), {
      target: { value: "models" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Source type" }), {
      target: { value: "newsletter" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /^ml/i })[0]);
    fireEvent.change(screen.getByRole("combobox", { name: "Verification" }), {
      target: { value: "false" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Apply filters" })[0]);

    expect(replaceMock).toHaveBeenLastCalledWith(
      "/reader?q=models&source_type=newsletter&topics=ml&verified=false",
      { scroll: false },
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Reset" })[0]);
    expect(replaceMock).toHaveBeenLastCalledWith("/reader", { scroll: false });
  });

  it("applies the mobile filter controls without losing query state", () => {
    currentSearchParams = new URLSearchParams();
    useSearchParamsMock.mockImplementation(() => currentSearchParams);
    vi.stubGlobal("fetch", vi.fn());

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
          query: "",
          feedIds: [],
          sourceType: null,
          topics: [],
          verified: null,
        }}
        initialBrowse={initialBrowse as never}
      />,
    );

    const mobilePanel = screen.getByText("Filters and view").closest("details");
    expect(mobilePanel).not.toBeNull();
    fireEvent.click(within(mobilePanel as HTMLElement).getByText("Filters and view"));

    fireEvent.change(within(mobilePanel as HTMLElement).getByLabelText("Search posts mobile"), {
      target: { value: "models" },
    });
    fireEvent.change(within(mobilePanel as HTMLElement).getByLabelText("Source type mobile"), {
      target: { value: "newsletter" },
    });
    fireEvent.change(within(mobilePanel as HTMLElement).getByLabelText("Add topic focus mobile"), {
      target: { value: "ml" },
    });
    fireEvent.change(within(mobilePanel as HTMLElement).getByLabelText("Verification mobile"), {
      target: { value: "false" },
    });
    fireEvent.change(within(mobilePanel as HTMLElement).getByLabelText("Reader view mobile"), {
      target: { value: "starred" },
    });
    fireEvent.change(within(mobilePanel as HTMLElement).getByLabelText("Sort articles mobile"), {
      target: { value: "source" },
    });
    fireEvent.click(
      within(mobilePanel as HTMLElement).getByRole("button", { name: "Apply filters" }),
    );

    expect(replaceMock).toHaveBeenLastCalledWith(
      "/reader?q=models&source_type=newsletter&topics=ml&verified=false&reader_view=starred&sort=source",
      { scroll: false },
    );
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
    expect(screen.getByRole("link", { name: "Clear article filters" })).toHaveAttribute(
      "href",
      "/reader?source_type=blog&verified=true&feed=feed-1",
    );
    expect(screen.getByRole("link", { name: "Reset all filters" })).toHaveAttribute(
      "href",
      "/reader",
    );
    expect(screen.getByRole("link", { name: "Browse sources" })).toHaveAttribute(
      "href",
      "/sources",
    );
  });

  it("shows active reader chips and lets the user clear an individual slice", () => {
    currentSearchParams = new URLSearchParams(
      "q=agents&source_type=blog&topics=agents&verified=true&feed=feed-1",
    );
    useSearchParamsMock.mockImplementation(() => currentSearchParams);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => makeResponse(initialBrowse)),
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
        initialState={initialState}
        initialBrowse={initialBrowse as never}
      />,
    );

    expect(screen.getByRole("button", { name: "Search: agents" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Type: blog" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Topic: agents" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verified only" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Source: Agent Feed" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Topic: agents" }));
    expect(replaceMock).toHaveBeenLastCalledWith(
      "/reader?q=agents&source_type=blog&verified=true&feed=feed-1",
      { scroll: false },
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

    expect(screen.getByRole("heading", { name: "Browse sources" })).toBeInTheDocument();
    expect(screen.getByText("Agent Feed")).toBeInTheDocument();
    expect(screen.getByText("ML Digest")).toBeInTheDocument();
  });
});
