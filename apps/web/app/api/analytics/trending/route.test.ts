import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadFeedCatalogMock, listTrendingMock } = vi.hoisted(() => ({
  loadFeedCatalogMock: vi.fn(),
  listTrendingMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/feeds", () => ({
  loadFeedCatalog: loadFeedCatalogMock,
}));

vi.mock("@/lib/server/trending-store", () => ({
  trendingStore: {
    list: listTrendingMock,
  },
}));

import { GET } from "./route";

const EMPTY_BODY = {
  demo: false,
  points: [],
};

function createRequest(url = "http://localhost/api/analytics/trending"): Request {
  return new Request(url);
}

describe("/api/analytics/trending route", () => {
  beforeEach(() => {
    loadFeedCatalogMock.mockReset();
    listTrendingMock.mockReset();
    listTrendingMock.mockResolvedValue([]);
    loadFeedCatalogMock.mockReturnValue({ sources: [] });
  });

  it("returns an empty non-demo body when storage has no rows", async () => {
    const response = await GET(createRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(EMPTY_BODY);
    expect(listTrendingMock).toHaveBeenCalledWith(10);
    expect(loadFeedCatalogMock).toHaveBeenCalledTimes(1);
  });

  it("returns an empty non-demo body when the snapshot and catalog cannot be read", async () => {
    listTrendingMock.mockRejectedValue(new Error("snapshot unavailable"));
    loadFeedCatalogMock.mockImplementation(() => {
      throw new Error("Failed to load feeds data from any source");
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(EMPTY_BODY);
  });

  it("counts real catalog topic rows and does not add forecast or ML series", async () => {
    loadFeedCatalogMock.mockReturnValue({
      sources: [
        { id: "a", title: "A", url: "https://a.example/feed", topics: ["llm", "agents"] },
        { id: "b", title: "B", url: "https://b.example/feed", topics: ["llm", "llm"] },
        { id: "c", title: "C", url: "https://c.example/feed", topics: ["  "] },
        { id: "d", title: "D", url: "https://d.example/feed", tags: ["safety"] },
      ],
    });

    const response = await GET(createRequest("http://localhost/api/analytics/trending?limit=10"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      demo: false,
      points: [
        { topic: "llm", count: 2, feed_count: 2 },
        { topic: "agents", count: 1, feed_count: 1 },
        { topic: "safety", count: 1, feed_count: 1 },
      ],
    });
    expect(Object.keys(body).sort()).toEqual(["demo", "points"]);
  });

  it("passes through validation snapshot counts without replacing them", async () => {
    listTrendingMock.mockResolvedValue([
      {
        topic: "llm",
        feed_count: 4,
        validation_count: 99,
        validation_frequency: 1.5,
        avg_health_score: 0.8,
      },
    ]);
    loadFeedCatalogMock.mockReturnValue({
      sources: [{ id: "other", title: "Other", url: "https://other.example", topics: ["agents"] }],
    });

    const response = await GET(createRequest("http://localhost/api/analytics/trending?limit=1"));

    expect(listTrendingMock).toHaveBeenCalledWith(1);
    expect(loadFeedCatalogMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      demo: false,
      points: [
        {
          topic: "llm",
          count: 4,
          feed_count: 4,
          validation_frequency: 1.5,
          avg_health_score: 0.8,
        },
      ],
    });
  });
});
