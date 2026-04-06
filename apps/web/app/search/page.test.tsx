import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { runLocalSearchMock } = vi.hoisted(() => ({
  runLocalSearchMock: vi.fn(),
}));

vi.mock("@/lib/search-local", () => ({
  runLocalSearch: runLocalSearchMock,
}));

vi.mock("@/components/search/search-page-client", () => ({
  SearchPageClient: (props: unknown) => (
    <pre data-testid="search-page-client">{JSON.stringify(props)}</pre>
  ),
}));

type SearchPageSearchParams = Record<string, string | string[] | undefined>;

async function loadSearchPage() {
  const module = await import("./page");
  return module.default;
}

async function renderPage(searchParams: SearchPageSearchParams = {}) {
  const SearchPage = await loadSearchPage();
  render(await SearchPage({ searchParams: Promise.resolve(searchParams) }));
}

function getClientProps(): {
  initialQuery: string;
  initialSearchState: {
    scope: "sources" | "articles";
    searchType: "sources" | "articles";
    search_type: "sources" | "articles";
    source_type?: string;
    topics: string[];
    verified?: boolean;
    threshold: number;
  };
  initialResults: Array<{ id: string; title: string }>;
  initialMeta: {
    mode: "unbounded" | "bounded";
    bounded: boolean;
    candidate_sources: number;
    scanned_sources: number;
    scan_limit: number | null;
    per_source_limit: number | null;
    truncated: boolean;
  };
  initialSearchRequestState: "idle" | "success" | "failed";
  shouldLogInitialSearch: boolean;
} {
  const payload = screen.getByTestId("search-page-client").textContent ?? "{}";
  return JSON.parse(payload) as ReturnType<typeof getClientProps>;
}

describe("SearchPage", () => {
  beforeEach(() => {
    vi.resetModules();
    runLocalSearchMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("hydrates the client island without fetching when there is no query", async () => {
    await renderPage();

    expect(runLocalSearchMock).not.toHaveBeenCalled();
    expect(getClientProps()).toEqual({
      initialQuery: "",
      initialSearchState: {
        scope: "sources",
        searchType: "sources",
        search_type: "sources",
        topics: [],
        threshold: 0.7,
      },
      initialResults: [],
      initialMeta: {
        mode: "unbounded",
        bounded: false,
        candidate_sources: 0,
        scanned_sources: 0,
        scan_limit: null,
        per_source_limit: null,
        truncated: false,
      },
      initialSearchRequestState: "idle",
      shouldLogInitialSearch: false,
    });
  });

  it("normalizes URL search params before hydrating and fetching initial results", async () => {
    runLocalSearchMock.mockResolvedValue({
      scope: "articles",
      results: [
        {
          id: "feed-1",
          kind: "source",
          title: "Feed One",
          url: "https://example.com/feed-1",
          topics: ["ml", "agents"],
          source_type: "podcast",
          verified: true,
          is_active: true,
          match_score: 22,
        },
      ],
      meta: {
        mode: "bounded",
        bounded: true,
        candidate_sources: 21,
        scanned_sources: 18,
        scan_limit: 18,
        per_source_limit: 4,
        truncated: true,
      },
    });

    await renderPage({
      q: "  agent   systems  ",
      scope: "articles",
      source_type: " podcast ",
      topics: "ml, agents,,ml",
      verified: "true",
    });

    expect(runLocalSearchMock).toHaveBeenCalledWith({
      query: "agent systems",
      scope: "articles",
      limit: 20,
      sourceType: "podcast",
      topics: ["ml", "agents"],
      verified: true,
    });
    expect(getClientProps()).toEqual({
      initialQuery: "agent systems",
      initialSearchState: {
        scope: "articles",
        searchType: "articles",
        search_type: "articles",
        source_type: "podcast",
        topics: ["ml", "agents"],
        verified: true,
        threshold: 0.7,
      },
      initialResults: [
        expect.objectContaining({
          id: "feed-1",
          title: "Feed One",
        }),
      ],
      initialMeta: {
        mode: "bounded",
        bounded: true,
        candidate_sources: 21,
        scanned_sources: 18,
        scan_limit: 18,
        per_source_limit: 4,
        truncated: true,
      },
      initialSearchRequestState: "success",
      shouldLogInitialSearch: true,
    });
  });

  it("keeps the normalized initial state but skips initial analytics when hydration fetch fails", async () => {
    runLocalSearchMock.mockRejectedValue(new Error("search unavailable"));

    await renderPage({
      q: "  agents  ",
      scope: "articles",
    });

    expect(runLocalSearchMock).toHaveBeenCalledWith({
      query: "agents",
      scope: "articles",
      limit: 20,
      sourceType: undefined,
      topics: [],
      verified: undefined,
    });
    expect(getClientProps()).toEqual({
      initialQuery: "agents",
      initialSearchState: {
        scope: "articles",
        searchType: "articles",
        search_type: "articles",
        topics: [],
        threshold: 0.7,
      },
      initialResults: [],
      initialMeta: {
        mode: "unbounded",
        bounded: false,
        candidate_sources: 0,
        scanned_sources: 0,
        scan_limit: null,
        per_source_limit: null,
        truncated: false,
      },
      initialSearchRequestState: "failed",
      shouldLogInitialSearch: false,
    });
  });
});
