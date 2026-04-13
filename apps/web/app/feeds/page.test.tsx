import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadFeedCatalogMock, runLocalSearchMock } = vi.hoisted(() => ({
  loadFeedCatalogMock: vi.fn(),
  runLocalSearchMock: vi.fn(),
}));

vi.mock("@/lib/feeds", () => ({
  loadFeedCatalog: loadFeedCatalogMock,
  getSourceTypes: vi.fn((feeds: Array<{ source_type?: string }>) =>
    Array.from(new Set(feeds.map((feed) => feed.source_type).filter(Boolean))).sort(),
  ),
  getFeedStats: vi.fn(
    (feeds: Array<{ source_type?: string; topics?: string[]; verified?: boolean }>) => ({
      total: feeds.length,
      sourceTypeCount: Array.from(new Set(feeds.map((feed) => feed.source_type).filter(Boolean)))
        .length,
      topicCount: Array.from(new Set(feeds.flatMap((feed) => feed.topics ?? []))).length,
      verified: feeds.filter((feed) => feed.verified === true).length,
      hasVerificationMetadata: feeds.some((feed) => typeof feed.verified === "boolean"),
    }),
  ),
}));

vi.mock("@/lib/search-local", () => ({
  runLocalSearch: runLocalSearchMock,
}));

vi.mock("./feed-catalog", () => ({
  FeedCatalog: (props: unknown) => <pre data-testid="feed-catalog">{JSON.stringify(props)}</pre>,
}));

vi.mock("./feeds-workspace-client", () => ({
  FeedsWorkspaceClient: (props: unknown) => (
    <pre data-testid="feeds-workspace-client">{JSON.stringify(props)}</pre>
  ),
}));

vi.mock("@/components/search/search-page-client", () => ({
  SearchPageClient: (props: unknown) => (
    <pre data-testid="search-page-client">{JSON.stringify(props)}</pre>
  ),
}));

vi.mock("@/components/reader/reader-page-client", () => ({
  ReaderPageClient: (props: unknown) => (
    <pre data-testid="reader-page-client">{JSON.stringify(props)}</pre>
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

describe("FeedsPage", () => {
  beforeEach(() => {
    vi.resetModules();
    loadFeedCatalogMock.mockReset();
    runLocalSearchMock.mockReset();
    loadFeedCatalogMock.mockReturnValue({ sources: FEEDS });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders reader mode by default and skips article hydration work", async () => {
    await renderPage({ q: "agents", source_type: "blog", verified: "true" });

    expect(runLocalSearchMock).not.toHaveBeenCalled();
    expect(getJsonProps("feeds-workspace-client")).toMatchObject({
      mode: "reader",
    });
    expect(getJsonProps("reader-page-client")).toMatchObject({
      feeds: [
        expect.objectContaining({
          id: "feed-1",
          title: "Agent Feed",
        }),
        expect.objectContaining({
          id: "feed-2",
          title: "ML Digest",
        }),
      ],
    });
  });

  it("hydrates article mode inside the unified /feeds workspace", async () => {
    runLocalSearchMock.mockResolvedValue({
      scope: "articles",
      results: [
        {
          id: "article-1",
          kind: "article",
          title: "Agent planning roundup",
          url: "https://example.com/article-1",
          topics: ["agents"],
          source_type: "blog",
          verified: true,
          is_active: true,
          match_score: 21,
          feed_id: "feed-1",
          feed_title: "Agent Feed",
        },
      ],
      meta: {
        mode: "bounded",
        bounded: true,
        candidate_sources: 8,
        scanned_sources: 6,
        scan_limit: 18,
        per_source_limit: 4,
        truncated: true,
      },
    });

    await renderPage({
      mode: "articles",
      q: "  agent   planning ",
      source_type: " blog ",
      topics: "agents,agents",
      verified: "true",
    });

    expect(runLocalSearchMock).toHaveBeenCalledWith({
      query: "agent planning",
      scope: "articles",
      limit: 20,
      feedIds: [],
      sourceType: "blog",
      topics: ["agents"],
      verified: true,
    });
    expect(getJsonProps("feeds-workspace-client")).toMatchObject({
      mode: "articles",
    });
    expect(getJsonProps("search-page-client")).toMatchObject({
      basePath: "/feeds",
      embedded: true,
      forceScope: "articles",
      routeMode: "articles",
      readerBasePath: "/feeds",
      readerMode: "reader",
      initialQuery: "agent planning",
    });
  });

  it("passes explicit feed slices into article mode hydration", async () => {
    runLocalSearchMock.mockResolvedValue({
      scope: "articles",
      results: [],
      meta: {
        mode: "bounded",
        bounded: true,
        candidate_sources: 2,
        scanned_sources: 2,
        scan_limit: 18,
        per_source_limit: 4,
        truncated: false,
      },
    });

    await renderPage({
      mode: "articles",
      q: "agent planning",
      feed: ["feed-2", "feed-1", "feed-2"],
    });

    expect(runLocalSearchMock).toHaveBeenCalledWith({
      query: "agent planning",
      scope: "articles",
      limit: 20,
      feedIds: ["feed-2", "feed-1"],
      sourceType: undefined,
      topics: [],
      verified: undefined,
    });
  });

  it("routes reader mode through the unified /feeds surface", async () => {
    await renderPage({ mode: "reader", source_type: "newsletter" });

    expect(getJsonProps("feeds-workspace-client")).toMatchObject({
      mode: "reader",
    });
    expect(getJsonProps("reader-page-client")).toMatchObject({
      feeds: [
        expect.objectContaining({
          id: "feed-1",
          title: "Agent Feed",
        }),
        expect.objectContaining({
          id: "feed-2",
          title: "ML Digest",
        }),
      ],
    });
  });
});
