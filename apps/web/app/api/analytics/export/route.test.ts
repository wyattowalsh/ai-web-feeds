import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAnalyticsSnapshotMock } = vi.hoisted(() => ({
  getAnalyticsSnapshotMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/analytics-local", () => ({
  getAnalyticsSnapshot: getAnalyticsSnapshotMock,
}));

import { GET } from "./route";

describe("GET /api/analytics/export", () => {
  beforeEach(() => {
    getAnalyticsSnapshotMock.mockReset();
  });

  it("includes source type distribution rows and scan summary rows in the CSV export", async () => {
    getAnalyticsSnapshotMock.mockResolvedValue({
      summary: {
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
      },
      trending: [],
      velocity: {
        granularity: "daily",
        data_points: [],
        avg_posts_per_source: 2.8,
        most_active_source: null,
        least_active_source: null,
        total_recent_posts: 91,
        last_updated: "2026-04-06T12:00:00.000Z",
        date_range: "30d",
      },
    });

    const response = await GET(
      new Request("http://localhost/api/analytics/export?date_range=30d&topic=agents"),
    );

    expect(response.status).toBe(200);
    expect(getAnalyticsSnapshotMock).toHaveBeenCalledWith("30d", "agents", null);

    const csv = await response.text();
    expect(csv).toContain('"source_type_distribution","newsletter","16"');
    expect(csv).toContain('"source_type_distribution","blog","14"');
    expect(csv).toContain('"scan_summary","matching_sources","38"');
    expect(csv).toContain('"scan_summary","per_source_limit","4"');
    expect(csv).toContain('"scan_summary","truncated","true"');
  });
});
