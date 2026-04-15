import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadReaderRouteDataMock } = vi.hoisted(() => ({
  loadReaderRouteDataMock: vi.fn(),
}));

vi.mock("@/lib/reader-route", () => ({
  loadReaderRouteData: loadReaderRouteDataMock,
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

describe("FeedsPage", () => {
  beforeEach(() => {
    vi.resetModules();
    loadReaderRouteDataMock.mockReset();
    loadReaderRouteDataMock.mockResolvedValue({
      mode: "reader",
      feeds: [{ id: "feed-1", title: "Agent Feed", url: "https://example.com/feed.xml" }],
      stats: {
        total: 1,
        verified: 1,
        active: 1,
        hasVerificationMetadata: true,
        hasActivityMetadata: true,
        sourceTypeCount: 1,
        byType: { blog: 1 },
        topicCount: 1,
      },
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
      initialBrowse: {
        items: [],
        next_cursor: null,
        total_matched: 1,
        cursor: 0,
        limit: 24,
        applied_query: "agent systems",
        applied_sort: "latest",
        corpus: {
          generated_at: "2026-04-12T00:00:00.000Z",
          source_db: "data/ai-web-feeds.db",
          article_count: 1,
          feed_count: 1,
          latest_published_at: "2026-04-05T12:00:00.000Z",
          is_empty: false,
        },
      },
    });
  });

  it("renders the compatibility feeds route through the shared reader loader", async () => {
    await renderPage({ q: "agent systems", feed: ["feed-1"] });

    expect(loadReaderRouteDataMock).toHaveBeenCalledTimes(1);
    expect(getJsonProps("feeds-workspace-client")).toMatchObject({
      mode: "reader",
      initialState: {
        query: "agent systems",
        feedIds: ["feed-1"],
      },
    });
  });

  it("keeps catalog mode available as an explicit compatibility submode", async () => {
    loadReaderRouteDataMock.mockResolvedValueOnce({
      mode: "catalog",
      feeds: [],
      stats: {
        total: 0,
        verified: 0,
        active: 0,
        hasVerificationMetadata: false,
        hasActivityMetadata: false,
        sourceTypeCount: 0,
        byType: {},
        topicCount: 0,
      },
      initialState: {
        query: "agents",
        feedIds: [],
        sourceType: null,
        topics: [],
        verified: null,
        sort: "latest",
        readerView: "latest",
        cursor: 0,
        limit: 24,
      },
      initialBrowse: null,
    });

    await renderPage({ mode: "catalog", q: "agents" });

    expect(getJsonProps("feeds-workspace-client")).toMatchObject({
      mode: "catalog",
      initialState: {
        query: "agents",
        readerView: "latest",
      },
      initialBrowse: null,
    });
  });
});
