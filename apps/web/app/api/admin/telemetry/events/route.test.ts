import { beforeEach, describe, expect, it, vi } from "vitest";

const { withBetterAuthAdminGuardMock, listApiTelemetryEventsMock, listAdminAuditEventsMock } =
  vi.hoisted(() => ({
    withBetterAuthAdminGuardMock: vi.fn(),
    listApiTelemetryEventsMock: vi.fn(),
    listAdminAuditEventsMock: vi.fn(),
  }));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/admin-auth-new", () => ({
  withBetterAuthAdminGuard: withBetterAuthAdminGuardMock,
}));

vi.mock("@/lib/telemetry", () => ({
  listApiTelemetryEvents: listApiTelemetryEventsMock,
  listAdminAuditEvents: listAdminAuditEventsMock,
  recordAdminAudit: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "./route";

describe("GET /api/admin/telemetry/events", () => {
  beforeEach(() => {
    withBetterAuthAdminGuardMock.mockReset();
    listApiTelemetryEventsMock.mockReset();
    listAdminAuditEventsMock.mockReset();
    listApiTelemetryEventsMock.mockResolvedValue([]);
    listAdminAuditEventsMock.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    withBetterAuthAdminGuardMock.mockResolvedValue({ status: "unauthorized" });

    const response = await GET(new Request("http://localhost/api/admin/telemetry/events"));

    expect(response.status).toBe(401);
    expect(listApiTelemetryEventsMock).not.toHaveBeenCalled();
  });

  it("returns 403 for non-admin sessions", async () => {
    withBetterAuthAdminGuardMock.mockResolvedValue({ status: "forbidden" });

    const response = await GET(new Request("http://localhost/api/admin/telemetry/events"));

    expect(response.status).toBe(403);
    expect(listApiTelemetryEventsMock).not.toHaveBeenCalled();
  });

  it("returns telemetry for admin sessions", async () => {
    withBetterAuthAdminGuardMock.mockResolvedValue({
      status: "ok",
      user: { id: "admin-1", email: "admin@example.com", role: "admin" },
    });

    const response = await GET(new Request("http://localhost/api/admin/telemetry/events"));

    expect(response.status).toBe(200);
    expect(listApiTelemetryEventsMock).toHaveBeenCalled();
  });
});
