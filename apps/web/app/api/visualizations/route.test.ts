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

import { GET, POST } from "./route";

const routeSource = readFileSync(join(process.cwd(), "app/api/visualizations/route.ts"), "utf8");

const EMPTY_BODY = { demo: false, points: [] };

const catalogRow = {
  id: "feed-1",
  title: "Agent Feed",
  url: "https://example.com/feed.xml",
  topics: ["agents"],
};

function listRequest(): Request {
  return new Request("http://localhost/api/visualizations");
}

function postRequest(body?: string): Request {
  return new Request("http://localhost/api/visualizations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("/api/visualizations route", () => {
  beforeEach(() => {
    loadFeedCatalogMock.mockReset();
    loadFeedCatalogMock.mockReturnValue({ sources: [] });
  });

  it("keeps demo false in source and does not synthesize a series", () => {
    expect(routeSource).toContain("catalogSeries");
    expect(routeSource).toContain("demo: false");
    expect(routeSource).not.toContain("Math.random");
    expect(routeSource).not.toContain("ChartBuilder");
    expect(routeSource).not.toContain("getDeviceId");
    expect(routeSource).not.toContain("device-id");
    expect(routeSource).not.toContain("three");
    expect(routeSource).not.toContain("fetchBackend");
    expect(routeSource).not.toContain("jwt");
  });

  it("returns an empty body when catalog storage is empty", async () => {
    const response = await GET(listRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(EMPTY_BODY);
    expect(loadFeedCatalogMock).toHaveBeenCalledTimes(1);
  });

  it("returns an empty body when catalog storage cannot be read", async () => {
    loadFeedCatalogMock.mockImplementation(() => {
      throw new Error("catalog missing");
    });

    const response = await GET(listRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(EMPTY_BODY);
  });

  it("returns an empty body for forecast-only storage", async () => {
    loadFeedCatalogMock.mockReturnValue({
      demo: true,
      forecast: [{ label: "Mon", value: 99 }],
      forecasts: [{ label: "Tue", value: 40 }],
    });

    const response = await GET(listRequest());

    await expect(response.json()).resolves.toEqual(EMPTY_BODY);
  });

  it("returns stored catalog rows without invented counts or forecast points", async () => {
    loadFeedCatalogMock.mockReturnValue({
      sources: [catalogRow],
      demo: true,
      forecast: [{ id: "future", title: "Forecast", date: "2026-02-01", value: 99 }],
    });

    const response = await GET(listRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      demo: false,
      points: [catalogRow],
    });
  });

  it("uses an empty POST body as empty storage", async () => {
    const response = await POST(postRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(EMPTY_BODY);
    expect(loadFeedCatalogMock).toHaveBeenCalledTimes(1);
  });

  it("uses caller catalog rows only and ignores forecasts", async () => {
    const callerRow = {
      id: "src-agents",
      title: "Agents Weekly",
      url: "https://example.com/agents.xml",
    };
    loadFeedCatalogMock.mockReturnValue({ sources: [catalogRow] });

    const response = await POST(
      postRequest(
        JSON.stringify({
          feeds: [callerRow],
          demo: true,
          forecast: [{ label: "Mon", value: 99 }],
        }),
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      demo: false,
      points: [callerRow],
    });
    expect(loadFeedCatalogMock).not.toHaveBeenCalled();
  });

  it("copies ml only when the caller supplies it", async () => {
    const row = { id: "topic-agents", label: "Agents", value: 2 };
    const ml = { model: "optional-extra", score: 0.25 };

    const response = await POST(
      postRequest(
        JSON.stringify({
          rows: [row],
          ml,
          forecasts: [{ label: "Agents", value: 50, date: "2026-04-01" }],
        }),
      ),
    );

    await expect(response.json()).resolves.toEqual({
      demo: false,
      points: [row],
      ml,
    });
    expect(loadFeedCatalogMock).not.toHaveBeenCalled();
  });

  it("does not turn invalid caller JSON into a series", async () => {
    loadFeedCatalogMock.mockReturnValue({ sources: [catalogRow] });

    const response = await POST(postRequest("{not-json"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(EMPTY_BODY);
    expect(loadFeedCatalogMock).not.toHaveBeenCalled();
  });
});
