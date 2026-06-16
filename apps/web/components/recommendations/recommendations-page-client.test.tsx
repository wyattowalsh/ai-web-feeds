import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
const testUserId = "00000000-0000-4000-8000-000000000001";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("RecommendationsPageClient", () => {
  beforeEach(() => {
    pushMock.mockReset();
    vi.restoreAllMocks();
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (init?.method === "POST") {
          return new Response(null, { status: 204 });
        }

        if (url === "/api/identity") {
          return new Response(JSON.stringify({ user_id: testUserId }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          });
        }

        if (url.startsWith("/api/recommendations")) {
          return new Response(
            JSON.stringify({
              recommendations: [
                {
                  feed: {
                    id: "feed-1",
                    title: "Agent Feed",
                    description: "A useful feed",
                    url: "https://example.com/feed-1.xml",
                    topics: ["agents"],
                    source_type: "blog",
                    verified: true,
                    is_active: true,
                  },
                  score: 0.94,
                  reason: "similar_topics",
                },
              ],
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            },
          );
        }

        return new Response(null, { status: 404 });
      }),
    );
  });

  // client chunk import + fetch settle can exceed the default 5s budget under parallel vitest load
  it("routes feed recommendations into the feeds workspace", async () => {
    const { RecommendationsPageClient } = await import("./recommendations-page-client");

    render(<RecommendationsPageClient />);

    fireEvent.click(await screen.findByRole("button", { name: "Open in catalog" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/sources?feed=feed-1&q=Agent+Feed");
    });
  }, 15000);

  it("shows the unavailable state without fetching when the backend is not configured", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/identity") {
        return new Response(JSON.stringify({ user_id: testUserId }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
      }

      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { RecommendationsPageClient } = await import("./recommendations-page-client");

    render(<RecommendationsPageClient backendConfigured={false} />);

    expect(await screen.findByText("Recommendations backend unavailable")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/identity",
      expect.objectContaining({ method: "GET" }),
    );
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).startsWith("/api/recommendations")),
    ).toBe(false);
  });
});
