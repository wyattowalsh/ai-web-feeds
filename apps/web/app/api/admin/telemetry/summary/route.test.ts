import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/admin-auth", () => ({
  withAdminRouteGuard: (handler: unknown) => handler,
}));

const telemetryStoreMock = vi.hoisted(() => ({
  getApiTelemetrySummary: vi.fn(),
  recordAdminAudit: vi.fn(),
}));

vi.mock("@/lib/telemetry", () => ({
  telemetryStore: telemetryStoreMock,
}));

import { GET } from "./route";

describe("GET /api/admin/telemetry/summary", () => {
  beforeEach(() => {
    telemetryStoreMock.getApiTelemetrySummary.mockReset();
    telemetryStoreMock.recordAdminAudit.mockReset();
  });

  it("reads and audits through telemetryStore", async () => {
    telemetryStoreMock.getApiTelemetrySummary.mockResolvedValue({
      windowHours: 24,
      requestCount: 1,
      errorCount: 0,
      errorRate: 0,
      averageDurationMs: 5,
      p50DurationMs: 5,
      p95DurationMs: 5,
      routeCount: 1,
      lastIngestedAt: "2025-01-01T00:00:00.000Z",
      statusCounts: { "200": 1 },
      routeBreakdown: [],
      recentErrors: [],
      auditEvents: [],
    });
    telemetryStoreMock.recordAdminAudit.mockResolvedValue(undefined);

    const response = await GET(
      new Request("http://localhost/api/admin/telemetry/summary?window_hours=12"),
    );
    expect(response.status).toBe(200);
    expect(telemetryStoreMock.getApiTelemetrySummary).toHaveBeenCalledWith(12);
    expect(telemetryStoreMock.recordAdminAudit).toHaveBeenCalledTimes(1);
  });
});
