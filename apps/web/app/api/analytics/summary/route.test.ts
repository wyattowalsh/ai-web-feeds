import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAnalyticsSummaryMock } = vi.hoisted(() => ({
  getAnalyticsSummaryMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/analytics-local", () => ({
  getAnalyticsSummary: getAnalyticsSummaryMock,
}));

import { GET } from "./route";

describe("GET /api/analytics/summary", () => {
  beforeEach(() => {
    getAnalyticsSummaryMock.mockReset();
  });

  it("returns local analytics summary fields including source type distribution and scan summary", async () => {
    getAnalyticsSummaryMock.mockResolvedValue({
      total_sources: 42,
      active_sources: 38,
      posts_last_24h: 14,
      posts_last_7d: 91,
      topic_count: 12,
      topic_distribution: [{ topic: "agents", count: 10 }],
      source_type_distribution: [
        { source_type: "newsletter", count: 16 },
        { source_type: "blog", count: 14 },
      ],
      scan_summary: {
        matching_sources: 38,
        scanned_sources: 32,
        scan_limit: 32,
        per_source_limit: 4,
        truncated: true,
      },
      freshest_sources: [],
      velocity_overview: {
        avg_posts_per_source: 2.8,
        total_recent_posts: 91,
        most_active_source: null,
      },
      last_updated: "2026-04-06T12:00:00.000Z",
      date_range: "30d",
      topic: "agents",
    });

    const response = await GET(
      new Request("http://localhost/api/analytics/summary?date_range=30d&topic=agents"),
    );

    expect(response.status).toBe(200);
    expect(getAnalyticsSummaryMock).toHaveBeenCalledWith("30d", "agents");
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        source_type_distribution: [
          { source_type: "newsletter", count: 16 },
          { source_type: "blog", count: 14 },
        ],
        scan_summary: {
          matching_sources: 38,
          scanned_sources: 32,
          scan_limit: 32,
          per_source_limit: 4,
          truncated: true,
        },
      }),
    );
  });
});
