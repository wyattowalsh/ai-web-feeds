import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchBackendMock } = vi.hoisted(() => ({
  fetchBackendMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/backend", async () => {
  const actual = await vi.importActual<typeof import("@/lib/backend")>("@/lib/backend");
  return {
    ...actual,
    fetchBackend: fetchBackendMock,
  };
});

import { BackendConfigurationError } from "@/lib/backend";

function createRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

async function loadRouteModule() {
  return import("./route");
}

describe("/api/analytics/summary route", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchBackendMock.mockReset();
  });

  it("forwards analytics filters to the backend", async () => {
    const { GET } = await loadRouteModule();
    fetchBackendMock.mockResolvedValue({ total_feeds: 3, last_updated: "2026-04-14T00:00:00Z" });

    const response = await GET(
      createRequest("http://localhost/api/analytics/summary?date_range=7d&topic=agents"),
    );

    expect(response.status).toBe(200);
    expect(fetchBackendMock).toHaveBeenCalledWith("/analytics/summary", {
      params: {
        date_range: "7d",
        topic: "agents",
      },
    });
  });

  it("returns FEATURE_UNAVAILABLE when BACKEND_URL is absent", async () => {
    const { GET } = await loadRouteModule();
    fetchBackendMock.mockRejectedValue(
      new BackendConfigurationError("BACKEND_URL environment variable not configured"),
    );

    const response = await GET(createRequest("http://localhost/api/analytics/summary"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Analytics are unavailable until BACKEND_URL points to the ai-web-feeds backend.",
      code: "FEATURE_UNAVAILABLE",
    });
  });
});
