import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SearchPage from "./page";

const { fetchBackendMock } = vi.hoisted(() => ({
  fetchBackendMock: vi.fn(),
}));

vi.mock("@/lib/backend", async () => {
  const actual = await vi.importActual<typeof import("@/lib/backend")>("@/lib/backend");
  return {
    ...actual,
    fetchBackend: fetchBackendMock,
  };
});

vi.mock("@/components/search/search-page-client", () => ({
  SearchPageClient: (props: unknown) => (
    <pre data-testid="search-page-client">{JSON.stringify(props)}</pre>
  ),
}));

type SearchPageSearchParams = Record<string, string | string[] | undefined>;

async function renderPage(searchParams: SearchPageSearchParams = {}) {
  render(await SearchPage({ searchParams: Promise.resolve(searchParams) }));
}

function getClientProps(): {
  initialQuery: string;
  initialSearchState: {
    searchType: "full_text" | "semantic";
    search_type: "full_text" | "semantic";
    source_type?: string;
    topics: string[];
    verified?: boolean;
    threshold: number;
  };
  initialResults: Array<{ id: string; title: string }>;
  initialSearchRequestState: "idle" | "success" | "failed";
  shouldLogInitialSearch: boolean;
} {
  const payload = screen.getByTestId("search-page-client").textContent ?? "{}";
  return JSON.parse(payload) as ReturnType<typeof getClientProps>;
}

describe("SearchPage", () => {
  beforeEach(() => {
    fetchBackendMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("hydrates the client island without fetching when there is no query", async () => {
    await renderPage();

    expect(fetchBackendMock).not.toHaveBeenCalled();
    expect(getClientProps()).toEqual({
      initialQuery: "",
      initialSearchState: {
        searchType: "full_text",
        search_type: "full_text",
        topics: [],
        threshold: 0.7,
      },
      initialResults: [],
      initialSearchRequestState: "idle",
      shouldLogInitialSearch: false,
    });
  });

  it("normalizes URL search params before hydrating and fetching initial results", async () => {
    fetchBackendMock.mockResolvedValue({
      results: [
        {
          id: "feed-1",
          title: "Feed One",
          url: "https://example.com/feed-1",
          topics: ["ml", "agents"],
          source_type: "podcast",
          verified: true,
          is_active: true,
        },
      ],
    });

    await renderPage({
      q: "  agent   systems  ",
      type: "semantic",
      source_type: " podcast ",
      topics: "ml, agents,,ml",
      verified: "bogus",
      threshold: "0.2",
    });

    expect(fetchBackendMock).toHaveBeenCalledWith("/search", {
      method: "GET",
      params: {
        q: "agent systems",
        type: "semantic",
        source_type: "podcast",
        topics: "ml,agents",
        threshold: 0.5,
      },
    });
    expect(getClientProps()).toEqual({
      initialQuery: "agent systems",
      initialSearchState: {
        searchType: "semantic",
        search_type: "semantic",
        source_type: "podcast",
        topics: ["ml", "agents"],
        threshold: 0.5,
      },
      initialResults: [
        {
          id: "feed-1",
          title: "Feed One",
          url: "https://example.com/feed-1",
          topics: ["ml", "agents"],
          source_type: "podcast",
          verified: true,
          is_active: true,
        },
      ],
      initialSearchRequestState: "success",
      shouldLogInitialSearch: true,
    });
  });

  it("keeps the normalized initial state but skips initial analytics when hydration fetch fails", async () => {
    fetchBackendMock.mockRejectedValue(new Error("backend down"));

    await renderPage({
      q: "  agents  ",
      type: "semantic",
      threshold: "0.9",
    });

    expect(fetchBackendMock).toHaveBeenCalledWith("/search", {
      method: "GET",
      params: {
        q: "agents",
        type: "semantic",
        threshold: 0.9,
      },
    });
    expect(getClientProps()).toEqual({
      initialQuery: "agents",
      initialSearchState: {
        searchType: "semantic",
        search_type: "semantic",
        topics: [],
        threshold: 0.9,
      },
      initialResults: [],
      initialSearchRequestState: "failed",
      shouldLogInitialSearch: false,
    });
  });
});
