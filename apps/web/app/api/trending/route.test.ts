import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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

import { BackendConfigurationError, BackendError } from "@/lib/backend";

function createRequest(url: string): NextRequest {
  return new NextRequest(url);
}

async function loadRouteModule() {
  return import("./route");
}

describe("/api/trending route", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchBackendMock.mockReset();
  });

  it("forwards a clamped limit to the backend", async () => {
    const { GET } = await loadRouteModule();
    fetchBackendMock.mockResolvedValue([{ topic: "agents" }]);

    const response = await GET(createRequest("http://localhost/api/trending?limit=500"));

    expect(response.status).toBe(200);
    expect(fetchBackendMock).toHaveBeenCalledWith("/storage/trending", {
      method: "GET",
      params: { limit: 100 },
    });
    await expect(response.json()).resolves.toMatchObject({
      trending: [{ topic: "agents" }],
      count: 1,
    });
  });

  it("returns a typed 503 when the backend is not configured", async () => {
    const { GET } = await loadRouteModule();
    fetchBackendMock.mockRejectedValue(
      new BackendConfigurationError("BACKEND_URL environment variable not configured"),
    );

    const response = await GET(createRequest("http://localhost/api/trending"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error:
        "Trending topics are unavailable until BACKEND_URL points to the ai-web-feeds backend.",
      code: "FEATURE_UNAVAILABLE",
    });
  });

  it("preserves backend error status and code", async () => {
    const { GET } = await loadRouteModule();
    fetchBackendMock.mockRejectedValue(new BackendError(502, "BAD_GATEWAY", "backend failed"));

    const response = await GET(createRequest("http://localhost/api/trending"));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "backend failed",
      code: "BAD_GATEWAY",
    });
  });
});
