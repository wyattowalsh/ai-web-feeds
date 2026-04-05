import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchPageClient, type SearchResult } from "./search-page-client";

const SHARED_USER_ID = "11111111-1111-4111-8111-111111111111";

type SavedSearchFilters = {
  search_type?: "full_text" | "semantic";
  source_type?: string;
  topics?: string[];
  verified?: boolean;
  threshold?: number;
};

const {
  ensureAnonymousUserIdMock,
  fetchWithAnonymousIdentityMock,
  getStoredUserIdMock,
  syncAnonymousUserIdFromResponseMock,
  pushMock,
  useSearchParamsMock,
} = vi.hoisted(() => ({
  ensureAnonymousUserIdMock: vi.fn(async () => SHARED_USER_ID),
  fetchWithAnonymousIdentityMock: vi.fn(),
  getStoredUserIdMock: vi.fn(() => SHARED_USER_ID),
  syncAnonymousUserIdFromResponseMock: vi.fn(() => SHARED_USER_ID),
  pushMock: vi.fn(),
  useSearchParamsMock: vi.fn(() => new URLSearchParams()),
}));

let currentSearchParams = new URLSearchParams();
let savedSearchToLoad: {
  query: string;
  filters: SavedSearchFilters;
} = {
  query: "loaded query",
  filters: {},
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => useSearchParamsMock(),
}));

vi.mock("@/lib/user-identity", () => ({
  ensureAnonymousUserId: ensureAnonymousUserIdMock,
  fetchWithAnonymousIdentity: fetchWithAnonymousIdentityMock,
  getStoredUserId: getStoredUserIdMock,
  syncAnonymousUserIdFromResponse: syncAnonymousUserIdFromResponseMock,
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
  }) => (
    <div data-testid="results">
      {loading ? "loading" : results.length > 0 ? results.map((result) => result.title).join(",") : "No results found"}
    </div>
  ),
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
    headers: { "Content-Type": "application/json" },
    status: init?.status ?? 200,
  });
}

const fetchMock = vi.fn<typeof fetch>();

function getFetchUrl(callIndex: number): URL {
  return new URL(fetchMock.mock.calls[callIndex]?.[0] as string, "https://aiwebfeeds.test");
}

function renderSearchPageClient({
  initialQuery = "",
  initialSearchState = {
    searchType: "full_text",
    search_type: "full_text",
    topics: [],
    threshold: 0.7,
  } as const,
  initialResults = [] as SearchResult[],
  initialSearchRequestState = initialQuery ? "success" : "idle",
  shouldLogInitialSearch = false,
} = {}) {
  render(
    <SearchPageClient
      initialQuery={initialQuery}
      initialSearchState={initialSearchState}
      initialResults={initialResults}
      initialSearchRequestState={initialSearchRequestState}
      shouldLogInitialSearch={shouldLogInitialSearch}
    />,
  );
}

describe("SearchPageClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    fetchMock.mockReset();
    pushMock.mockReset();
    ensureAnonymousUserIdMock.mockReset();
    ensureAnonymousUserIdMock.mockResolvedValue(SHARED_USER_ID);
    fetchWithAnonymousIdentityMock.mockReset();
    fetchWithAnonymousIdentityMock.mockImplementation((...args: Parameters<typeof fetch>) => fetchMock(...args));
    getStoredUserIdMock.mockReset();
    getStoredUserIdMock.mockReturnValue(SHARED_USER_ID);
    syncAnonymousUserIdFromResponseMock.mockReset();
    syncAnonymousUserIdFromResponseMock.mockReturnValue(SHARED_USER_ID);
    currentSearchParams = new URLSearchParams();
    useSearchParamsMock.mockImplementation(() => currentSearchParams);
    pushMock.mockImplementation((url: string) => {
      const parsed = new URL(url, "https://aiwebfeeds.test");
      currentSearchParams = new URLSearchParams(parsed.search);
      useSearchParamsMock.mockImplementation(() => currentSearchParams);
    });
    savedSearchToLoad = {
      query: "loaded query",
      filters: {},
    };

    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("shows the onboarding state without mounting an empty results panel", async () => {
    renderSearchPageClient();

    expect(screen.getByText("Start here")).toBeInTheDocument();
    expect(screen.queryByTestId("results")).not.toBeInTheDocument();
    expect(screen.queryByText("No results found")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(ensureAnonymousUserIdMock).toHaveBeenCalled();
    });
  });

  it("waits for authoritative bootstrap before logging a hydrated initial search", async () => {
    let resolveIdentityBootstrap: ((value: string) => void) | undefined;
    const sharedBootstrapPromise = new Promise<string>((resolve) => {
      resolveIdentityBootstrap = resolve;
    });
    ensureAnonymousUserIdMock.mockReturnValue(sharedBootstrapPromise);
    getStoredUserIdMock.mockReturnValue(null);
    currentSearchParams = new URLSearchParams(
      "q=agent+systems&type=semantic&source_type=podcast&topics=ml,agents&threshold=0.5",
    );
    useSearchParamsMock.mockImplementation(() => currentSearchParams);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    renderSearchPageClient({
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
          id: "seed-1",
          title: "Seed Result",
          url: "https://example.com/seed-1",
          topics: ["ml", "agents"],
          source_type: "podcast",
          verified: true,
          is_active: true,
        },
      ],
      initialSearchRequestState: "success",
      shouldLogInitialSearch: true,
    });

    expect(fetchMock).not.toHaveBeenCalled();

    resolveIdentityBootstrap?.(SHARED_USER_ID);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const analyticsRequest = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const analyticsBody = JSON.parse(String(analyticsRequest.body)) as {
      query: string;
      result_count: number;
      type: string;
    };

    expect(analyticsRequest.method).toBe("POST");
    expect(analyticsBody).toMatchObject({
      query: "agent systems",
      type: "semantic",
      result_count: 1,
      user_id: SHARED_USER_ID,
    });
    expect(screen.getByTestId("results")).toHaveTextContent("Seed Result");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("waits for authoritative bootstrap before the first manual search analytics write and saved search", async () => {
    let resolveIdentityBootstrap: ((value: string) => void) | undefined;
    const sharedBootstrapPromise = new Promise<string>((resolve) => {
      resolveIdentityBootstrap = resolve;
    });
    ensureAnonymousUserIdMock.mockReturnValue(sharedBootstrapPromise);
    getStoredUserIdMock.mockReturnValue(null);
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

    renderSearchPageClient();

    fireEvent.click(screen.getByRole("button", { name: "Run Search" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const searchRequest = getFetchUrl(0);
    expect(searchRequest.pathname).toBe("/api/search");
    expect(searchRequest.searchParams.get("q")).toBe("fresh query");

    resolveIdentityBootstrap?.(SHARED_USER_ID);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const analyticsRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const analyticsBody = JSON.parse(String(analyticsRequest.body)) as {
      user_id: string;
      result_count: number;
    };

    expect(analyticsBody.user_id).toBe(SHARED_USER_ID);
    expect(analyticsBody.result_count).toBe(1);

    const saveButton = await screen.findByRole("button", { name: /save search/i });
    fireEvent.click(saveButton);
    fireEvent.change(screen.getByPlaceholderText("e.g. LLM safety papers"), {
      target: { value: "My search" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    const saveRequest = fetchMock.mock.calls[2]?.[1] as RequestInit;
    const saveBody = JSON.parse(String(saveRequest.body)) as {
      query_text: string;
      search_name: string;
      user_id: string;
    };

    expect(await screen.findByTestId("saved-user-id")).toHaveTextContent(SHARED_USER_ID);
    expect(saveBody).toMatchObject({
      user_id: SHARED_USER_ID,
      search_name: "My search",
      query_text: "fresh query",
    });
  });

  it("retries a failed initial hydration on the client before showing an empty state", async () => {
    currentSearchParams = new URLSearchParams("q=agent+systems&type=semantic&topics=ml&threshold=0.5");
    useSearchParamsMock.mockImplementation(() => currentSearchParams);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              id: "retry-1",
              title: "Recovered Result",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    renderSearchPageClient({
      initialQuery: "agent systems",
      initialSearchState: {
        searchType: "semantic",
        search_type: "semantic",
        topics: ["ml"],
        threshold: 0.5,
      },
      initialResults: [],
      initialSearchRequestState: "failed",
      shouldLogInitialSearch: false,
    });

    expect(screen.getByTestId("results")).toHaveTextContent("loading");
    expect(screen.queryByText("No results found")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const retryRequest = getFetchUrl(0);
    expect(retryRequest.pathname).toBe("/api/search");
    expect(retryRequest.searchParams.get("q")).toBe("agent systems");
    const retryAnalytics = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(retryAnalytics.method).toBe("POST");
    expect(screen.getByTestId("results")).toHaveTextContent("Recovered Result");
  });

  it("shows no results only after the failed initial hydration retry completes", async () => {
    currentSearchParams = new URLSearchParams("q=agent+systems&type=semantic&topics=ml&threshold=0.5");
    useSearchParamsMock.mockImplementation(() => currentSearchParams);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    renderSearchPageClient({
      initialQuery: "agent systems",
      initialSearchState: {
        searchType: "semantic",
        search_type: "semantic",
        topics: ["ml"],
        threshold: 0.5,
      },
      initialResults: [],
      initialSearchRequestState: "failed",
      shouldLogInitialSearch: false,
    });

    expect(screen.getByTestId("results")).toHaveTextContent("loading");
    expect(screen.queryByText("No results found")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByTestId("results")).toHaveTextContent("No results found");
  });

  it("loads saved searches with the intended filters instead of stale local state", async () => {
    currentSearchParams = new URLSearchParams(
      "type=full_text&source_type=blog&topics=old&verified=true&threshold=0.55",
    );
    useSearchParamsMock.mockImplementation(() => currentSearchParams);
    savedSearchToLoad = {
      query: "loaded query",
      filters: {
        search_type: "semantic",
        source_type: "podcast",
        topics: ["ml", "vision"],
        verified: false,
        threshold: 0.82,
      },
    };

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    renderSearchPageClient({
      initialSearchState: {
        searchType: "full_text",
        search_type: "full_text",
        source_type: "blog",
        topics: ["old"],
        verified: true,
        threshold: 0.55,
      },
    });

    await screen.findByTestId("saved-user-id");
    fireEvent.click(screen.getByRole("button", { name: "Load Saved Search" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const searchUrl = getFetchUrl(0);
    expect(searchUrl.pathname).toBe("/api/search");
    expect(searchUrl.searchParams.get("q")).toBe("loaded query");
    expect(searchUrl.searchParams.get("type")).toBe("semantic");
    expect(searchUrl.searchParams.get("source_type")).toBe("podcast");
    expect(searchUrl.searchParams.get("topics")).toBe("ml,vision");
    expect(searchUrl.searchParams.get("verified")).toBe("false");
    expect(searchUrl.searchParams.get("threshold")).toBe("0.82");
    expect(pushMock).toHaveBeenCalledWith(
      "/search?q=loaded+query&type=semantic&source_type=podcast&topics=ml%2Cvision&verified=false&threshold=0.82",
    );

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
        source_type: "podcast",
        topics: ["ml", "vision"],
        verified: false,
        threshold: 0.82,
      },
    });
    expect(screen.getByTestId("filters")).toHaveTextContent(
      JSON.stringify({
        searchType: "semantic",
        sourceType: "podcast",
        topics: ["ml", "vision"],
        verified: false,
        threshold: 0.82,
      }),
    );
  });

  it("ignores stale search responses when a newer request finishes first", async () => {
    let resolveFirst: ((value: Response) => void) | undefined;
    let resolveSecond: ((value: Response) => void) | undefined;
    const first = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<Response>((resolve) => {
      resolveSecond = resolve;
    });

    fetchMock
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(() => second)
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    renderSearchPageClient();

    await screen.findByTestId("saved-user-id");
    fireEvent.click(screen.getByRole("button", { name: "Run Search" }));
    fireEvent.click(screen.getByRole("button", { name: "Run Search" }));

    resolveSecond?.(jsonResponse({ results: [{ id: "new", title: "New Result" }] }));
    await waitFor(() => {
      expect(screen.getByTestId("results")).toHaveTextContent("New Result");
    });

    resolveFirst?.(jsonResponse({ results: [{ id: "old", title: "Old Result" }] }));
    await waitFor(() => {
      expect(screen.getByTestId("results")).not.toHaveTextContent("Old Result");
    });
  });
});
