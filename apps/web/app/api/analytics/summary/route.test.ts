import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { readFileMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const promises = {
    ...actual.promises,
    readFile: readFileMock,
  };
  return {
    ...actual,
    promises,
    default: {
      ...actual,
      promises,
    },
  };
});

const ZERO_SUMMARY = {
  total_feeds: 0,
  active_feeds: 0,
  verified_feeds: 0,
  total_topics: 0,
  validation_success_rate: 0,
  avg_response_time: 0,
  health_distribution: {
    healthy: 0,
    moderate: 0,
    unhealthy: 0,
  },
  date_range: "30d",
  topic: null,
  last_updated: null,
  demo: false,
  forecast_enabled: false,
  ml: null,
};

function missingFile(): Promise<never> {
  const error = new Error("ENOENT") as NodeJS.ErrnoException;
  error.code = "ENOENT";
  return Promise.reject(error);
}

function fileName(filePath: unknown): string {
  return String(filePath);
}

async function loadRouteModule() {
  return import("./route");
}

describe("/api/analytics/summary route", () => {
  beforeEach(() => {
    vi.resetModules();
    readFileMock.mockReset();
    readFileMock.mockImplementation(() => missingFile());
  });

  it("returns a zero summary with demo false when storage is empty", async () => {
    const { GET } = await loadRouteModule();

    const response = await GET(new Request("http://localhost/api/analytics/summary"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(ZERO_SUMMARY);
    expect(body.demo).toBe(false);
    expect(body.forecast_enabled).toBe(false);
    expect(body.ml).toBeNull();
    expect(readFileMock).toHaveBeenCalled();
  });

  it("returns a zero summary when the catalog and validation snapshot have no rows", async () => {
    const { GET } = await loadRouteModule();
    readFileMock.mockImplementation((filePath: unknown) => {
      const name = fileName(filePath);
      if (name.endsWith("feeds.enriched.json")) {
        return Promise.resolve(JSON.stringify({ sources: [], document_meta: {} }));
      }
      if (name.endsWith("validation-snapshot.json")) {
        return Promise.resolve(JSON.stringify({ total_feeds: 12345, active_feeds: 99 }));
      }
      return missingFile();
    });

    const response = await GET(
      new Request("http://localhost/api/analytics/summary?date_range=7d&topic=agents"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ...ZERO_SUMMARY,
      date_range: "7d",
      topic: "agents",
    });
  });

  it("counts stored catalog and validation rows instead of snapshot totals", async () => {
    const validatedAt = new Date().toISOString();
    readFileMock.mockImplementation((filePath: unknown) => {
      const name = fileName(filePath);
      if (name.endsWith("feeds.enriched.json")) {
        return Promise.resolve(
          JSON.stringify({
            document_meta: { updated: "2026-06-29" },
            sources: [
              {
                id: "feed-a",
                url: "https://example.com/a.xml",
                title: "Agents",
                topics: ["agents"],
                verified: true,
                is_active: true,
                quality_score: 0.91,
              },
              {
                id: "feed-b",
                url: "https://example.com/b.xml",
                title: "Dormant",
                topics: ["llm"],
                verified: false,
                is_active: false,
                curation_status: "inactive",
                quality_score: 0.2,
              },
            ],
          }),
        );
      }
      if (name.endsWith("validation-snapshot.json")) {
        return Promise.resolve(
          JSON.stringify({
            total_feeds: 12345,
            active_feeds: 99,
            validation_success_rate: 0.99,
            validations: [
              {
                feed_source_id: "feed-a",
                is_valid: true,
                response_time_ms: 120,
                validated_at: validatedAt,
              },
              {
                feed_source_id: "feed-b",
                is_valid: false,
                is_accessible: false,
                format_valid: false,
                response_time_ms: 50,
                validated_at: validatedAt,
              },
              {
                feed_source_id: "feed-a",
                is_valid: false,
                validated_at: "2000-01-01T00:00:00.000Z",
              },
            ],
          }),
        );
      }
      return missingFile();
    });

    const { GET: getSummary } = await loadRouteModule();
    const response = await getSummary(new Request("http://localhost/api/analytics/summary"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      total_feeds: 2,
      active_feeds: 1,
      verified_feeds: 1,
      total_topics: 2,
      validation_success_rate: 0.5,
      avg_response_time: 120,
      health_distribution: { healthy: 1, moderate: 0, unhealthy: 1 },
      date_range: "30d",
      topic: null,
      last_updated: validatedAt,
      demo: false,
      forecast_enabled: false,
      ml: null,
    });

    const filtered = await getSummary(
      new Request("http://localhost/api/analytics/summary?date_range=90d&topic=agents"),
    );
    await expect(filtered.json()).resolves.toEqual({
      total_feeds: 1,
      active_feeds: 1,
      verified_feeds: 1,
      total_topics: 1,
      validation_success_rate: 1,
      avg_response_time: 120,
      health_distribution: { healthy: 1, moderate: 0, unhealthy: 0 },
      date_range: "90d",
      topic: "agents",
      last_updated: validatedAt,
      demo: false,
      forecast_enabled: false,
      ml: null,
    });
  });

  it("states demo false in source and does not synthesize totals", () => {
    const source = readFileSync(join(process.cwd(), "app/api/analytics/summary/route.ts"), "utf8");

    expect(source).toContain("demo: false");
    expect(source.includes("sample" + "_analytics_data")).toBe(false);
    expect(source.includes("Math" + ".random")).toBe(false);
    expect(source).not.toContain("total_feeds: 12345");
  });
});
