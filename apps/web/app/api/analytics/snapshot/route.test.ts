import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadFeedCatalogMock, getValidationStatsMock } = vi.hoisted(() => ({
  loadFeedCatalogMock: vi.fn(),
  getValidationStatsMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/feeds", async () => {
  const actual = await vi.importActual<typeof import("@/lib/feeds")>("@/lib/feeds");
  return {
    ...actual,
    loadFeedCatalog: loadFeedCatalogMock,
  };
});

vi.mock("@/lib/validation-stats", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/validation-stats")>("@/lib/validation-stats");
  return {
    ...actual,
    getValidationStats: getValidationStatsMock,
  };
});

import { getDefaultValidationStats } from "@/lib/validation-stats";

const routeSource = readFileSync(
  join(process.cwd(), "app/api/analytics/snapshot/route.ts"),
  "utf8",
);

function createRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

async function loadRouteModule() {
  return import("./route");
}

describe("/api/analytics/snapshot route", () => {
  beforeEach(() => {
    vi.resetModules();
    loadFeedCatalogMock.mockReset();
    getValidationStatsMock.mockReset();
    loadFeedCatalogMock.mockReturnValue({ sources: [] });
    getValidationStatsMock.mockResolvedValue(getDefaultValidationStats());
  });

  it("returns a non-demo empty body when catalog and validation storage are empty", async () => {
    const { GET, POST } = await loadRouteModule();

    const getResponse = await GET(createRequest("http://localhost/api/analytics/snapshot"));
    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toEqual({ demo: false, points: [] });

    const postResponse = await POST(
      createRequest("http://localhost/api/analytics/snapshot", { method: "POST" }),
    );
    expect(postResponse.status).toBe(200);
    await expect(postResponse.json()).resolves.toEqual({ demo: false, points: [] });
  });

  it("returns the same empty body when catalog and validation reads fail", async () => {
    loadFeedCatalogMock.mockImplementation(() => {
      throw new Error("catalog missing");
    });
    getValidationStatsMock.mockRejectedValue(new Error("validation missing"));

    const { GET } = await loadRouteModule();
    const response = await GET(createRequest("http://localhost/api/analytics/snapshot"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ demo: false, points: [] });
  });

  it("counts stored catalog rows and does not invent a series", async () => {
    loadFeedCatalogMock.mockReturnValue({
      sources: [
        {
          id: "feed-1",
          title: "Agent Feed",
          url: "https://example.com/feed.xml",
          source_type: "blog",
          topics: ["agents"],
          verified: true,
          is_active: true,
        },
        {
          id: "feed-2",
          title: "Signals",
          url: "https://example.com/signals.xml",
          source_type: "newsletter",
          topics: ["ml"],
        },
      ],
    });

    const { GET } = await loadRouteModule();
    const response = await GET(createRequest("http://localhost/api/analytics/snapshot"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      demo: false,
      points: [],
      forecast_enabled: false,
      total_feeds: 2,
      active_feeds: 1,
      verified_feeds: 1,
      topic_count: 2,
      source_type_count: 2,
    });
  });

  it("copies a validation snapshot without synthesizing points", async () => {
    getValidationStatsMock.mockResolvedValue({
      ...getDefaultValidationStats(),
      total_feeds: 4,
      validated_feeds: 4,
      success_count: 3,
      failure_count: 1,
      success_rate: 75,
      avg_response_time_ms: 120,
      healthy_feeds: 3,
      avg_health_score: 0.8,
      last_validation_run: "2026-06-24T00:00:00Z",
      validation_data_available: true,
    });

    const { GET } = await loadRouteModule();
    const response = await GET(createRequest("http://localhost/api/analytics/snapshot"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      demo: false,
      points: [],
      forecast_enabled: false,
      total_feeds: 4,
      validated_feeds: 4,
      success_count: 3,
      failure_count: 1,
      success_rate: 75,
      avg_response_time_ms: 120,
      healthy_feeds: 3,
      avg_health_score: 0.8,
      last_validation_run: "2026-06-24T00:00:00Z",
    });
  });

  it("keeps demo false in source and does not synthesize a series", () => {
    expect(routeSource).toContain("demo: false");
    expect(routeSource).not.toContain("Math.random");
    expect(routeSource).not.toContain("sample_analytics");
  });
});
