import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/admin-auth", () => ({
  withAdminRouteGuard: (handler: unknown) => handler,
}));

const telemetryStoreMock = vi.hoisted(() => ({
  listApiTelemetryEvents: vi.fn(),
  listAdminAuditEvents: vi.fn(),
  recordAdminAudit: vi.fn(),
}));

vi.mock("@/lib/telemetry", () => ({
  telemetryStore: telemetryStoreMock,
}));

import { GET } from "./route";

describe("GET /api/admin/telemetry/events", () => {
  beforeEach(() => {
    telemetryStoreMock.listApiTelemetryEvents.mockReset();
    telemetryStoreMock.listAdminAuditEvents.mockReset();
    telemetryStoreMock.recordAdminAudit.mockReset();
  });

  it("reads and audits through telemetryStore", async () => {
    telemetryStoreMock.listApiTelemetryEvents.mockResolvedValue([]);
    telemetryStoreMock.listAdminAuditEvents.mockResolvedValue([]);
    telemetryStoreMock.recordAdminAudit.mockResolvedValue(undefined);

    const response = await GET(
      new Request(
        "http://localhost/api/admin/telemetry/events?window_hours=6&limit=20&route_key=feeds.list&status=error",
      ),
    );

    expect(response.status).toBe(200);
    expect(telemetryStoreMock.listApiTelemetryEvents).toHaveBeenCalledWith({
      limit: 20,
      routeKey: "feeds.list",
      status: "error",
      windowHours: 6,
    });
    expect(telemetryStoreMock.listAdminAuditEvents).toHaveBeenCalledWith(25);
    expect(telemetryStoreMock.recordAdminAudit).toHaveBeenCalledTimes(1);
  });
});
