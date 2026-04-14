import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { browseArticleCorpusMock, getFeedStatsMock, loadFeedCatalogMock } = vi.hoisted(() => ({
  browseArticleCorpusMock: vi.fn(),
  getFeedStatsMock: vi.fn(),
  loadFeedCatalogMock: vi.fn(),
}));

vi.mock("@/lib/article-corpus", () => ({
  browseArticleCorpus: browseArticleCorpusMock,
}));

vi.mock("@/lib/feeds", () => ({
  loadFeedCatalog: loadFeedCatalogMock,
  getFeedStats: getFeedStatsMock,
}));

vi.mock("./feeds-workspace-client", () => ({
  FeedsWorkspaceClient: (props: unknown) => (
    <pre data-testid="feeds-workspace-client">{JSON.stringify(props)}</pre>
  ),
}));

type FeedsPageSearchParams = Record<string, string | string[] | undefined>;

async function loadFeedsPage() {
  const pageModule = await import("./page");
  return pageModule.default;
}

async function renderPage(searchParams: FeedsPageSearchParams = {}) {
  const FeedsPage = await loadFeedsPage();
  render(await FeedsPage({ searchParams: Promise.resolve(searchParams) }));
}

function getJsonProps(testId: string) {
  return JSON.parse(screen.getByTestId(testId).textContent ?? "{}") as Record<string, unknown>;
}

const FEEDS = [
  {
    id: "feed-1",
    title: "Agent Feed",
    url: "https://example.com/feed-1.xml",
    source_type: "blog",
    topics: ["agents"],
    verified: true,
    is_active: true,
  },
  {
    id: "feed-2",
    title: "ML Digest",
    url: "https://example.com/feed-2.xml",
    source_type: "newsletter",
    topics: ["ml"],
    verified: false,
    is_active: true,
  },
] as const;

const INITIAL_BROWSE = {
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
  applied_query: "agent systems",
  applied_sort: "latest",
  filters: {
    feedIds: ["feed-1"],
    sourceType: "blog",
    topics: ["agents"],
    verified: true,
  },
  corpus: {
    generated_at: "2026-04-12T00:00:00.000Z",
    source_db: "data/ai-web-feeds.db",
    article_count: 1,
    feed_count: 1,
    latest_published_at: "2026-04-05T12:00:00.000Z",
    is_empty: false,
  },
};

describe("FeedsPage", () => {
  beforeEach(() => {
    vi.resetModules();
    browseArticleCorpusMock.mockReset();
    getFeedStatsMock.mockReset();
    loadFeedCatalogMock.mockReset();
    loadFeedCatalogMock.mockReturnValue({ sources: FEEDS });
    getFeedStatsMock.mockReturnValue({
      total: FEEDS.length,
      sourceTypeCount: 2,
      topicCount: 2,
      verified: 1,
      active: 2,
      hasVerificationMetadata: true,
      hasActivityMetadata: true,
    });
  });

  it("defaults to the reader workspace and seeds the corpus browse snapshot", async () => {
    browseArticleCorpusMock.mockResolvedValue(INITIAL_BROWSE);

    await renderPage({
      q: "  agent systems ",
      feed: ["feed-1", "feed-1"],
      source_type: " blog ",
      topics: "agents,agents",
      verified: "true",
    });

    expect(browseArticleCorpusMock).toHaveBeenCalledWith({
      q: "agent systems",
      feedIds: ["feed-1"],
      sourceType: "blog",
      topics: ["agents"],
      verified: true,
      sort: "latest",
      cursor: 0,
      limit: 24,
    });
    expect(getJsonProps("feeds-workspace-client")).toMatchObject({
      mode: "reader",
      initialState: {
        query: "agent systems",
        feedIds: ["feed-1"],
        sourceType: "blog",
        topics: ["agents"],
        verified: true,
        sort: "latest",
        readerView: "latest",
        cursor: 0,
        limit: 24,
      },
      initialBrowse: INITIAL_BROWSE,
    });
  });

  it("keeps catalog mode as the explicit source picker and skips corpus hydration", async () => {
    await renderPage({ mode: "catalog", q: "agents" });

    expect(browseArticleCorpusMock).not.toHaveBeenCalled();
    expect(getJsonProps("feeds-workspace-client")).toMatchObject({
      mode: "catalog",
      initialState: {
        query: "agents",
        readerView: "latest",
      },
      initialBrowse: null,
    });
  });

  it.each(["articles", "reader"] as const)(
    "normalizes legacy mode=%s into reader state",
    async (mode) => {
      browseArticleCorpusMock.mockResolvedValue(INITIAL_BROWSE);

      await renderPage({ mode, q: "agents" });

      expect(getJsonProps("feeds-workspace-client")).toMatchObject({
        mode: "reader",
      });
      expect(browseArticleCorpusMock).toHaveBeenCalledTimes(1);
    },
  );
});
