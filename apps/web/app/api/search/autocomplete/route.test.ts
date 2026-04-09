import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFeeds } from "@/lib/feeds";

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/feeds", () => ({
  loadFeeds: vi.fn(),
}));

import { GET } from "./route";

function createRequest(url: string): Request {
  return new Request(url);
}

describe("/api/search/autocomplete route", () => {
  beforeEach(() => {
    vi.mocked(loadFeeds).mockReset();
  });

  it("returns prefix-matched feed and topic suggestions after trimming whitespace", async () => {
    vi.mocked(loadFeeds).mockResolvedValue({
      sources: [
        {
          id: "feed-1",
          title: "Machine Learning Weekly",
          url: "https://example.com/ml",
          topics: ["ml", "agents"],
        },
        {
          id: "feed-2",
          title: "Agent Systems Daily",
          url: "https://example.com/agents",
          topics: ["agents"],
        },
      ],
    });

    const response = await GET(
      createRequest("http://localhost/api/search/autocomplete?prefix=%20ag%20"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      feeds: [
        {
          id: "feed-2",
          title: "Agent Systems Daily",
          type: "feed",
          url: "https://example.com/agents",
        },
      ],
      topics: [
        {
          label: "agents",
          type: "topic",
          feed_count: 2,
        },
      ],
    });
  });

  it("does not return substring title matches that are not word prefixes", async () => {
    vi.mocked(loadFeeds).mockResolvedValue({
      sources: [
        {
          id: "feed-1",
          title: "Machine Learning Weekly",
          url: "https://example.com/ml",
          topics: ["agents"],
        },
      ],
    });

    const response = await GET(
      createRequest("http://localhost/api/search/autocomplete?prefix=ear"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      feeds: [],
      topics: [],
    });
  });

  it("returns empty suggestions for short prefixes", async () => {
    const response = await GET(createRequest("http://localhost/api/search/autocomplete?prefix=a"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      feeds: [],
      topics: [],
    });
    expect(loadFeeds).not.toHaveBeenCalled();
  });
});
