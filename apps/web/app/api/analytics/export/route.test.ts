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

vi.mock("@/lib/feeds", () => ({
  loadFeedCatalog: loadFeedCatalogMock,
}));

vi.mock("@/lib/validation-stats", () => ({
  getValidationStats: getValidationStatsMock,
}));

const routeSource = readFileSync(join(process.cwd(), "app/api/analytics/export/route.ts"), "utf8");

const emptyValidationSnapshot = {
  total_feeds: 0,
  validated_feeds: 0,
  success_count: 0,
  failure_count: 0,
  success_rate: null,
  avg_response_time_ms: null,
  healthy_feeds: 0,
  avg_health_score: null,
  last_validation_run: null,
  validation_data_available: false,
  data_source: "filesystem" as const,
  top_errors: [],
};

function createRequest(): Request {
  return new Request("http://localhost/api/analytics/export");
}

async function loadRouteModule() {
  return import("./route");
}

describe("/api/analytics/export route", () => {
  beforeEach(() => {
    vi.resetModules();
    loadFeedCatalogMock.mockReset();
    getValidationStatsMock.mockReset();
    loadFeedCatalogMock.mockReturnValue({ sources: [] });
    getValidationStatsMock.mockResolvedValue(emptyValidationSnapshot);
  });

  it("keeps demo false in source and does not synthesize values", () => {
    expect(routeSource).toContain("demo: false");
    expect(routeSource).not.toContain("Math.random");
    expect(routeSource).not.toContain("sample");
  });

  it("returns an empty body when catalog and validation storage are empty", async () => {
    const { GET } = await loadRouteModule();

    const response = await GET(createRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ demo: false, points: [] });
  });

  it("returns an empty body when both readers fail", async () => {
    const { GET } = await loadRouteModule();
    loadFeedCatalogMock.mockImplementation(() => {
      throw new Error("catalog missing");
    });
    getValidationStatsMock.mockRejectedValue(new Error("validation snapshot missing"));

    const response = await GET(createRequest());

    await expect(response.json()).resolves.toEqual({ demo: false, points: [] });
  });

  it("returns catalog rows and does not invent counts", async () => {
    const { GET } = await loadRouteModule();
    const catalogRow = {
      id: "feed-1",
      title: "Agent Feed",
      url: "https://example.com/feed.xml",
      topics: ["agents"],
    };
    loadFeedCatalogMock.mockReturnValue({ sources: [catalogRow] });

    const response = await GET(createRequest());

    await expect(response.json()).resolves.toEqual({
      demo: false,
      points: [catalogRow],
    });
    expect(getValidationStatsMock).not.toHaveBeenCalled();
  });

  it("does not turn an unavailable validation snapshot into counts", async () => {
    const { GET } = await loadRouteModule();
    getValidationStatsMock.mockResolvedValue({
      ...emptyValidationSnapshot,
      total_feeds: 12,
      validated_feeds: 4,
      success_count: 3,
    });

    const response = await GET(createRequest());

    await expect(response.json()).resolves.toEqual({ demo: false, points: [] });
  });

  it("passes recorded validation points through when the catalog is empty", async () => {
    const { GET } = await loadRouteModule();
    const recordedPoint = { feed_id: "feed-1", is_valid: true, item_count: 2 };
    getValidationStatsMock.mockResolvedValue({
      ...emptyValidationSnapshot,
      validation_data_available: true,
      points: [recordedPoint],
      total_feeds: 99,
    });

    const response = await GET(createRequest());

    await expect(response.json()).resolves.toEqual({
      demo: false,
      points: [recordedPoint],
    });
  });
});
