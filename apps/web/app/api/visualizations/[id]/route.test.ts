import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadFeedCatalogMock } = vi.hoisted(() => ({
  loadFeedCatalogMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/feeds", () => ({
  loadFeedCatalog: loadFeedCatalogMock,
}));

import { GET } from "./route";

const routeSource = readFileSync(
  join(process.cwd(), "app/api/visualizations/[id]/route.ts"),
  "utf8",
);

const EMPTY_BODY = { demo: false, points: [] };

function createContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("/api/visualizations/[id] route", () => {
  beforeEach(() => {
    vi.resetModules();
    loadFeedCatalogMock.mockReset();
    loadFeedCatalogMock.mockReturnValue({ sources: [] });
  });

  it("keeps demo false and does not synthesize a series", () => {
    expect(routeSource).toContain("demo: false");
    expect(routeSource).toContain("catalogSeries");
    expect(routeSource).not.toContain("Math.random");
    expect(routeSource).not.toContain("ChartBuilder");
    expect(routeSource).not.toContain("getDeviceId");
    expect(routeSource).not.toContain("device-id");
    expect(routeSource).not.toContain("fetchBackend");
    expect(routeSource).not.toContain("forecast");
    expect(routeSource).not.toMatch(/from ["']three["']/);
  });

  it("returns an empty body for an empty id", async () => {
    const response = await GET(
      new Request("http://localhost/api/visualizations/"),
      createContext(""),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(EMPTY_BODY);
    expect(loadFeedCatalogMock).not.toHaveBeenCalled();
  });

  it("returns an empty body for a blank id", async () => {
    const response = await GET(
      new Request("http://localhost/api/visualizations/%20"),
      createContext("   "),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(EMPTY_BODY);
    expect(loadFeedCatalogMock).not.toHaveBeenCalled();
  });

  it("returns an empty body for an unknown id", async () => {
    loadFeedCatalogMock.mockReturnValue({
      sources: [
        {
          id: "feed-1",
          title: "Agent Feed",
          url: "https://example.com/feed.xml",
          topics: ["agents"],
        },
      ],
    });

    const response = await GET(
      new Request("http://localhost/api/visualizations/missing"),
      createContext("missing"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(EMPTY_BODY);
  });

  it("returns an empty body when the catalog cannot be read", async () => {
    loadFeedCatalogMock.mockImplementation(() => {
      throw new Error("catalog missing");
    });

    const response = await GET(
      new Request("http://localhost/api/visualizations/feed-1"),
      createContext("feed-1"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(EMPTY_BODY);
  });

  it("returns an empty body when catalog sources are not rows", async () => {
    loadFeedCatalogMock.mockReturnValue({ sources: { id: "feed-1", title: "Agent Feed" } });

    const response = await GET(
      new Request("http://localhost/api/visualizations/feed-1"),
      createContext("feed-1"),
    );

    await expect(response.json()).resolves.toEqual(EMPTY_BODY);
  });

  it("returns the matching catalog row and does not invent counts", async () => {
    const catalogRow = {
      id: "feed-1",
      title: "Agent Feed",
      url: "https://example.com/feed.xml",
      topics: ["agents"],
    };
    const otherRow = {
      id: "feed-2",
      title: "Other",
      url: "https://example.com/other.xml",
    };
    loadFeedCatalogMock.mockReturnValue({ sources: [otherRow, catalogRow] });

    const response = await GET(
      new Request("http://localhost/api/visualizations/feed-1"),
      createContext("feed-1"),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ demo: false, points: [catalogRow] });
    expect(Object.keys(body).sort()).toEqual(["demo", "points"]);
    expect(body.points[0]).not.toHaveProperty("count");
    expect(body.points[0]).not.toHaveProperty("value");
    expect(body).not.toHaveProperty("forecast");
    expect(JSON.stringify(body)).not.toContain("99");
  });

  it("matches a catalog feed or url without adding rows", async () => {
    const byFeed = {
      id: "feed-1",
      feed: "agent-feed",
      title: "Agent Feed",
      url: "https://example.com/feed.xml",
    };
    loadFeedCatalogMock.mockReturnValue({ sources: [byFeed] });

    const byFeedResponse = await GET(
      new Request("http://localhost/api/visualizations/agent-feed"),
      createContext("agent-feed"),
    );
    await expect(byFeedResponse.json()).resolves.toEqual({ demo: false, points: [byFeed] });

    const byUrlResponse = await GET(
      new Request("http://localhost/api/visualizations/by-url"),
      createContext("https://example.com/feed.xml"),
    );
    await expect(byUrlResponse.json()).resolves.toEqual({ demo: false, points: [byFeed] });
  });
});
