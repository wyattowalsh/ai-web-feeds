import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SavedSearches } from "./saved-searches";

vi.mock("@/components/search/search-artwork", () => ({
  SEARCH_ARTWORKS: {
    savedSearchesEmpty: {
      src: "/search/illustrations/saved-searches-empty.webp",
      alt: "Saved searches artwork",
      width: 1200,
      height: 900,
      pendingDescription: "Saved searches artwork pending.",
    },
  },
  SearchArtworkSlot: () => <div data-testid="saved-searches-artwork" />,
}));

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status: init?.status ?? 200,
  });
}

describe("SavedSearches", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders an unavailable state when saved-search storage is not configured", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        searches: [],
        unavailable: true,
        error:
          "Saved searches are unavailable because search storage is not configured for this environment.",
        code: "BACKEND_UNAVAILABLE",
      }),
    );

    render(<SavedSearches userId="11111111-1111-4111-8111-111111111111" onLoadSearch={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Saved searches unavailable")).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "Saved searches are unavailable because search storage is not configured for this environment.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("No saved searches yet")).not.toBeInTheDocument();
    expect(screen.getByTestId("saved-searches-artwork")).toBeInTheDocument();
  });

  it("surfaces non-success API responses instead of falling back to the empty state", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "Missing or invalid user_id" }, { status: 400 }),
    );

    render(<SavedSearches userId="11111111-1111-4111-8111-111111111111" onLoadSearch={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Couldn't load saved searches")).toBeInTheDocument();
    });

    expect(screen.getByText("Missing or invalid user_id")).toBeInTheDocument();
    expect(screen.queryByText("No saved searches yet")).not.toBeInTheDocument();
  });
});
