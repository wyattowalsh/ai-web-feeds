import { beforeEach, describe, expect, it, vi } from "vitest";

const { withBetterAuthAdminGuardMock, getApiTelemetrySummaryMock } = vi.hoisted(() => ({
  withBetterAuthAdminGuardMock: vi.fn(),
  getApiTelemetrySummaryMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/admin-auth-new", () => ({
  withBetterAuthAdminGuard: withBetterAuthAdminGuardMock,
}));

vi.mock("@/lib/telemetry", () => ({
  getApiTelemetrySummary: getApiTelemetrySummaryMock,
  recordAdminAudit: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "./route";

describe("GET /api/admin/telemetry/summary", () => {
  beforeEach(() => {
    withBetterAuthAdminGuardMock.mockReset();
    getApiTelemetrySummaryMock.mockReset();
    getApiTelemetrySummaryMock.mockResolvedValue({ routes: [] });
  });

  it("returns 401 when unauthenticated", async () => {
    withBetterAuthAdminGuardMock.mockResolvedValue({ status: "unauthorized" });

    const response = await GET(new Request("http://localhost/api/admin/telemetry/summary"));

    expect(response.status).toBe(401);
    expect(getApiTelemetrySummaryMock).not.toHaveBeenCalled();
  });

  it("returns 403 for non-admin sessions", async () => {
    withBetterAuthAdminGuardMock.mockResolvedValue({ status: "forbidden" });

    const response = await GET(new Request("http://localhost/api/admin/telemetry/summary"));

    expect(response.status).toBe(403);
    expect(getApiTelemetrySummaryMock).not.toHaveBeenCalled();
  });

  it("returns summary for admin sessions", async () => {
    withBetterAuthAdminGuardMock.mockResolvedValue({
      status: "ok",
      user: { id: "admin-1", email: "admin@example.com", role: "admin" },
    });

    const response = await GET(new Request("http://localhost/api/admin/telemetry/summary"));

    expect(response.status).toBe(200);
    expect(getApiTelemetrySummaryMock).toHaveBeenCalled();
  });
});
