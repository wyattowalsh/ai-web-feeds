import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchResponseMeta, SearchResult } from "@/lib/search";

const SHARED_USER_ID = "11111111-1111-4111-8111-111111111111";

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
    scope,
    onScopeChange,
  }: {
    scope: string;
    onScopeChange: (scope: "sources" | "articles") => void;
  }) => (
    <div>
      <span data-testid="scope">{scope}</span>
      <button type="button" onClick={() => onScopeChange("articles")}>
        Scope Articles
      </button>
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
      {loading
        ? "loading"
        : results.length > 0
          ? results.map((result) => result.title).join(",")
          : "No results"}
    </div>
  ),
}));

import { SearchPageClient, type InitialSearchRequestState } from "./search-page-client";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: init?.status ?? 200,
  });
}

const fetchMock = vi.fn<typeof fetch>();

function renderSearchPageClient({
  initialQuery = "",
  initialSearchState = {
    scope: "sources",
    searchType: "sources",
    search_type: "sources",
    topics: [],
    threshold: 0.7,
  } as const,
  initialResults = [] as SearchResult[],
  initialMeta = {
    mode: "local",
    bounded: false,
    candidate_sources: 0,
    scanned_sources: 0,
    scan_limit: null,
    per_source_limit: null,
    truncated: false,
  } satisfies SearchResponseMeta,
  initialSearchRequestState = (initialQuery ? "success" : "idle") as InitialSearchRequestState,
  shouldLogInitialSearch = false,
} = {}) {
  render(
    <SearchPageClient
      initialQuery={initialQuery}
      initialSearchState={initialSearchState}
      initialResults={initialResults}
      initialMeta={initialMeta}
      initialSearchRequestState={initialSearchRequestState}
      shouldLogInitialSearch={shouldLogInitialSearch}
    />,
  );
}

describe("SearchPageClient", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    pushMock.mockReset();
    ensureAnonymousUserIdMock.mockReset();
    ensureAnonymousUserIdMock.mockResolvedValue(SHARED_USER_ID);
    fetchWithAnonymousIdentityMock.mockReset();
    fetchWithAnonymousIdentityMock.mockImplementation((...args: Parameters<typeof fetch>) =>
      fetchMock(...args),
    );
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

    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("shows the onboarding state without rendering results", async () => {
    renderSearchPageClient();

    expect(screen.getByText("Start here")).toBeInTheDocument();
    expect(screen.queryByTestId("results")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(ensureAnonymousUserIdMock).toHaveBeenCalled();
    });
  });

  it("logs a hydrated initial search once identity bootstrap resolves", async () => {
    let resolveIdentityBootstrap: ((value: string) => void) | undefined;
    const sharedBootstrapPromise = new Promise<string>((resolve) => {
      resolveIdentityBootstrap = resolve;
    });
    ensureAnonymousUserIdMock.mockReturnValue(sharedBootstrapPromise);
    getStoredUserIdMock.mockReturnValue(null);

    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    currentSearchParams = new URLSearchParams(
      "q=agent+systems&scope=sources&source_type=podcast&topics=ml,agents&verified=true",
    );
    useSearchParamsMock.mockImplementation(() => currentSearchParams);

    renderSearchPageClient({
      initialQuery: "agent systems",
      initialSearchState: {
        scope: "sources",
        searchType: "sources",
        search_type: "sources",
        source_type: "podcast",
        topics: ["ml", "agents"],
        verified: true,
        threshold: 0.7,
      },
      initialResults: [
        {
          id: "feed-1",
          kind: "source",
          title: "Seed Result",
          url: "https://example.com/seed-1",
          topics: ["ml", "agents"],
          source_type: "podcast",
          verified: true,
          is_active: true,
          match_score: 20,
        },
      ],
      initialSearchRequestState: "success",
      initialMeta: {
        mode: "local",
        bounded: false,
        candidate_sources: 1,
        scanned_sources: 1,
        scan_limit: null,
        per_source_limit: null,
        truncated: false,
      },
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
      type: "full_text",
      result_count: 1,
      user_id: SHARED_USER_ID,
    });
    expect(screen.getByTestId("results")).toHaveTextContent("Seed Result");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("updates the URL and runs a search when a new query is submitted", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              id: "feed-2",
              kind: "source",
              title: "Fresh Result",
              url: "https://example.com/fresh",
              topics: ["agents"],
              source_type: "blog",
              verified: true,
              is_active: true,
              match_score: 15,
            },
          ],
          meta: {
            mode: "local",
            bounded: false,
            candidate_sources: 1,
            scanned_sources: 1,
            scan_limit: null,
            per_source_limit: null,
            truncated: false,
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    renderSearchPageClient();

    fireEvent.click(screen.getByText("Run Search"));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/search?q=fresh+query&scope=sources");
    });
    await waitFor(() => {
      expect(screen.getByTestId("results")).toHaveTextContent("Fresh Result");
    });
  });

  it("reruns the active query when the scope changes", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          results: [],
          meta: {
            mode: "local",
            bounded: true,
            candidate_sources: 33,
            scanned_sources: 18,
            scan_limit: 18,
            per_source_limit: 4,
            truncated: true,
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    currentSearchParams = new URLSearchParams("q=agents&scope=sources");
    useSearchParamsMock.mockImplementation(() => currentSearchParams);

    renderSearchPageClient({
      initialQuery: "agents",
      initialSearchState: {
        scope: "sources",
        searchType: "sources",
        search_type: "sources",
        topics: [],
        threshold: 0.7,
      },
      initialResults: [],
      initialMeta: {
        mode: "local",
        bounded: false,
        candidate_sources: 0,
        scanned_sources: 0,
        scan_limit: null,
        per_source_limit: null,
        truncated: false,
      },
      initialSearchRequestState: "success",
    });

    fireEvent.click(screen.getByText("Scope Articles"));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/search?q=agents&scope=articles");
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/search?q=agents&scope=articles");
  });
});
