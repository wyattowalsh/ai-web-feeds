import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadReaderRouteDataMock } = vi.hoisted(() => ({
  loadReaderRouteDataMock: vi.fn(),
}));

vi.mock("@/lib/reader-route", () => ({
  loadReaderRouteData: loadReaderRouteDataMock,
}));

vi.mock("@/app/feeds/feeds-workspace-client", () => ({
  FeedsWorkspaceClient: (props: unknown) => (
    <pre data-testid="feeds-workspace-client">{JSON.stringify(props)}</pre>
  ),
}));

async function loadHomePage() {
  const pageModule = await import("./page");
  return pageModule.default;
}

describe("HomePage", () => {
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
        query: "",
        feedIds: [],
        sourceType: null,
        topics: [],
        verified: null,
        sort: "latest",
        readerView: "latest",
        cursor: 0,
        limit: 24,
      },
      initialBrowse: {
        items: [],
        next_cursor: null,
        total_matched: 0,
        cursor: 0,
        limit: 24,
        applied_query: null,
        applied_sort: "latest",
        corpus: {
          generated_at: null,
          source_db: "data/ai-web-feeds.db",
          article_count: 0,
          feed_count: 1,
          latest_published_at: null,
          is_empty: false,
        },
      },
    });
  });

  it("renders the canonical reader on the homepage", async () => {
    const HomePage = await loadHomePage();
    render(await HomePage({ searchParams: Promise.resolve({ q: "agents" }) }));

    expect(loadReaderRouteDataMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("feeds-workspace-client")).toBeInTheDocument();
  });
});
