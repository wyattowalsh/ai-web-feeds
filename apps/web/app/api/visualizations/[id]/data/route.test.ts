import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

import { POST } from "./route";

const EMPTY_BODY = {
  demo: false,
  points: [],
};

const routeSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "route.ts"), "utf8");

const catalogRow = {
  id: "feed-1",
  title: "Agent Feed",
  url: "https://example.com/feed.xml",
  topics: ["agents", "ml"],
};

const otherRow = {
  id: "feed-2",
  title: "Other Feed",
  url: "https://example.com/other.xml",
  topics: ["models"],
};

function createRequest(): Request {
  return new Request("http://localhost/api/visualizations/feed-1/data", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      demo: true,
      feeds: [
        {
          id: "injected",
          title: "Injected",
          url: "https://example.com/injected.xml",
          value: 99,
        },
      ],
      forecast: [{ label: "Mon", value: 99 }],
    }),
  });
}

function createContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("/api/visualizations/[id]/data route", () => {
  beforeEach(() => {
    loadFeedCatalogMock.mockReset();
    loadFeedCatalogMock.mockReturnValue({ sources: [] });
  });

  it("keeps demo false in source and does not fabricate a series", () => {
    expect(routeSource).toContain("demo: false");
    expect(routeSource).toContain("catalogSeries");
    expect(routeSource).not.toMatch(/Math\.random/);
    expect(routeSource).not.toMatch(/from ["']three["']/);
    expect(routeSource).not.toMatch(/ChartBuilder/);
    expect(routeSource).not.toMatch(/getDeviceId/);
    expect(routeSource).not.toMatch(/device-id/);
    expect(routeSource).not.toMatch(/fetchBackend/);
    expect(routeSource).not.toMatch(/demo:\s*true/);
    expect(routeSource).not.toMatch(/generateSampleData/);
  });

  it("returns an empty body when catalog storage is empty", async () => {
    const response = await POST(createRequest(), createContext("feed-1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(EMPTY_BODY);
  });

  it("returns an empty body when catalog storage cannot be read", async () => {
    loadFeedCatalogMock.mockImplementation(() => {
      throw new Error("catalog missing");
    });

    const response = await POST(createRequest(), createContext("feed-1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(EMPTY_BODY);
  });

  it("returns an empty body when the id has no catalog rows", async () => {
    loadFeedCatalogMock.mockReturnValue({
      sources: [catalogRow, otherRow],
      demo: true,
      forecast: [{ id: "future", title: "Forecast", value: 99 }],
      ml: { model: "unused", score: 0.2 },
    });

    const response = await POST(createRequest(), createContext("missing"));
    const body = await response.json();

    expect(body).toEqual(EMPTY_BODY);
    expect(Object.keys(body).sort()).toEqual(["demo", "points"]);
    expect(JSON.stringify(body)).not.toContain("99");
    expect(JSON.stringify(body)).not.toContain("Forecast");
    expect(JSON.stringify(body)).not.toContain("Injected");
  });

  it("returns only the catalog rows for the id and drops forecasts", async () => {
    loadFeedCatalogMock.mockReturnValue({
      sources: [catalogRow, otherRow],
      demo: true,
      forecast: [{ label: "Mon", value: 99 }],
      forecasts: [{ label: "Tue", value: 40 }],
      ml: { model: "unused", score: 0.2 },
    });

    const response = await POST(createRequest(), createContext("feed-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ demo: false, points: [catalogRow] });
    expect(body.demo).toBe(false);
    expect(Object.keys(body).sort()).toEqual(["demo", "points"]);
    expect(body.points).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("99");
    expect(JSON.stringify(body)).not.toContain("Other Feed");
    expect(JSON.stringify(body)).not.toContain("Forecast");
  });

  it("uses a visualization slot of catalog rows and ignores an empty slot", async () => {
    loadFeedCatalogMock.mockReturnValue({
      visualizations: {
        "viz-1": {
          feeds: [catalogRow],
          demo: true,
          forecast: [{ label: "Mon", value: 99 }],
        },
        "viz-empty": {
          points: [],
          forecast: [{ label: "Tue", value: 40 }],
        },
      },
      sources: [otherRow],
    });

    const match = await POST(createRequest(), createContext("viz-1"));
    await expect(match.json()).resolves.toEqual({ demo: false, points: [catalogRow] });

    const empty = await POST(createRequest(), createContext("viz-empty"));
    await expect(empty.json()).resolves.toEqual(EMPTY_BODY);

    const missing = await POST(createRequest(), createContext("viz-missing"));
    await expect(missing.json()).resolves.toEqual(EMPTY_BODY);
  });

  it("returns an empty body for a blank id even when the catalog has rows", async () => {
    loadFeedCatalogMock.mockReturnValue({ sources: [catalogRow] });

    const response = await POST(createRequest(), createContext("   "));

    await expect(response.json()).resolves.toEqual(EMPTY_BODY);
  });
});
