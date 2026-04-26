import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadReaderRouteDataMock } = vi.hoisted(() => ({
  loadReaderRouteDataMock: vi.fn(),
}));

vi.mock("@/lib/reader-route", () => ({
  loadReaderRouteData: loadReaderRouteDataMock,
}));

vi.mock("../feeds/feeds-workspace-client", () => ({
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
        query: "agents",
        feedIds: ["feed-1", "feed-2"],
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
  });

  it("renders the canonical reader at the homepage", async () => {
    const HomePage = await loadHomePage();

    render(
      await HomePage({
        searchParams: Promise.resolve({ q: "agents", feed: ["feed-1", "feed-2"] }),
      }),
    );

    expect(loadReaderRouteDataMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("feeds-workspace-client")).toHaveTextContent('"mode":"reader"');
  });
});
