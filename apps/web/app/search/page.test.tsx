import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SearchPage from "./page";

const SHARED_USER_ID = "11111111-1111-4111-8111-111111111111";

const {
  getUserIdMock,
  pushMock,
  useSearchParamsMock,
} = vi.hoisted(() => ({
  getUserIdMock: vi.fn(() => "11111111-1111-4111-8111-111111111111"),
  pushMock: vi.fn(),
  useSearchParamsMock: vi.fn(() => new URLSearchParams()),
}));

let savedSearchToLoad: {
  query: string;
  filters: {
    source_type?: string;
    topics?: string[];
    verified?: boolean;
    threshold?: number;
  };
} = {
  query: "loaded query",
  filters: {},
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => useSearchParamsMock(),
}));

vi.mock("@/lib/user-identity", () => ({
  getUserId: getUserIdMock,
}));

vi.mock("@/components/search/search-bar", () => ({
  SearchBar: ({
    initialQuery,
    onSearch,
  }: {
    initialQuery?: string;
    onSearch: (query: string) => void;
  }) => (
    <div>
      <span data-testid="initial-query">{initialQuery}</span>
      <button type="button" onClick={() => onSearch("fresh query")}>
        Run Search
      </button>
    </div>
  ),
}));

vi.mock("@/components/search/search-filters", () => ({
  SearchFilters: ({
    searchType,
    sourceType,
    threshold,
    topics,
    verified,
  }: {
    searchType: string;
    sourceType?: string;
    threshold: number;
    topics: string[];
    verified?: boolean;
  }) => (
    <div data-testid="filters">
      {JSON.stringify({ searchType, sourceType, topics, verified, threshold })}
    </div>
  ),
}));

vi.mock("@/components/search/search-results", () => ({
  SearchResults: ({
    loading,
    results,
  }: {
    loading: boolean;
    results: Array<{ id: string; title: string }>;
  }) => <div data-testid="results">{loading ? "loading" : results.map((result) => result.title).join(",")}</div>,
}));

vi.mock("@/components/search/saved-searches", () => ({
  SavedSearches: ({
    onLoadSearch,
    userId,
  }: {
    userId: string;
    onLoadSearch: (query: string, filters: Record<string, unknown>) => void;
  }) => (
    <div>
      <span data-testid="saved-user-id">{userId}</span>
      <button type="button" onClick={() => onLoadSearch(savedSearchToLoad.query, savedSearchToLoad.filters)}>
        Load Saved Search
      </button>
    </div>
  ),
}));

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status: init?.status ?? 200,
  });
}

function getFetchUrl(callIndex: number): URL {
  return new URL(fetchMock.mock.calls[callIndex]?.[0] as string, "https://aiwebfeeds.test");
}

const fetchMock = vi.fn<typeof fetch>();

describe("SearchPage", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    pushMock.mockReset();
    getUserIdMock.mockClear();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    savedSearchToLoad = {
      query: "loaded query",
      filters: {},
    };

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal("prompt", vi.fn(() => null));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("uses the shared anonymous user ID when saving a search", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              id: "feed-1",
              title: "Feed One",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ id: "saved-1" }, { status: 201 }));

    vi.mocked(globalThis.prompt).mockReturnValue("My search");

    render(<SearchPage />);

    await screen.findByTestId("saved-user-id");
    fireEvent.click(screen.getByRole("button", { name: "Run Search" }));

    const saveButton = await screen.findByRole("button", { name: /save search/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    const saveRequest = fetchMock.mock.calls[2]?.[1] as RequestInit;
    const saveBody = JSON.parse(String(saveRequest.body)) as {
      query_text: string;
      search_name: string;
      user_id: string;
    };

    expect(getUserIdMock).toHaveBeenCalled();
    expect(saveBody).toMatchObject({
      user_id: SHARED_USER_ID,
      search_name: "My search",
      query_text: "fresh query",
    });
    expect(window.alert).toHaveBeenCalledWith("Search saved successfully!");
  });

  it("shows a save failure instead of a false success when the API rejects the request", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              id: "feed-1",
              title: "Feed One",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(
        jsonResponse({ error: "Missing or invalid user_id" }, { status: 400 }),
      );

    vi.mocked(globalThis.prompt).mockReturnValue("Broken search");

    render(<SearchPage />);

    await screen.findByTestId("saved-user-id");
    fireEvent.click(screen.getByRole("button", { name: "Run Search" }));

    const saveButton = await screen.findByRole("button", { name: /save search/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Missing or invalid user_id");
    });

    expect(window.alert).not.toHaveBeenCalledWith("Search saved successfully!");
  });

  it("loads saved searches with the intended filters instead of stale state", async () => {
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams("type=semantic&source_type=blog&topics=old&verified=true&threshold=0.55"),
    );
    savedSearchToLoad = {
      query: "loaded query",
      filters: {
        verified: false,
      },
    };

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    render(<SearchPage />);

    await screen.findByTestId("saved-user-id");
    fireEvent.click(screen.getByRole("button", { name: "Load Saved Search" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const searchUrl = getFetchUrl(0);
    expect(searchUrl.pathname).toBe("/api/search");
    expect(searchUrl.searchParams.get("q")).toBe("loaded query");
    expect(searchUrl.searchParams.get("type")).toBe("semantic");
    expect(searchUrl.searchParams.get("source_type")).toBeNull();
    expect(searchUrl.searchParams.get("topics")).toBeNull();
    expect(searchUrl.searchParams.get("verified")).toBe("false");
    expect(searchUrl.searchParams.get("threshold")).toBe("0.7");

    const analyticsRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const analyticsBody = JSON.parse(String(analyticsRequest.body)) as {
      filters: {
        source_type?: string;
        topics: string[];
        verified?: boolean;
        threshold: number;
      };
      type: string;
      user_id: string;
    };

    expect(analyticsBody).toMatchObject({
      type: "semantic",
      user_id: SHARED_USER_ID,
      filters: {
        topics: [],
        verified: false,
        threshold: 0.7,
      },
    });
    expect(analyticsBody.filters.source_type).toBeUndefined();
  });
});
