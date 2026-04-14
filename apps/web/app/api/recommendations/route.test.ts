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

import { BackendConfigurationError, BackendError } from "@/lib/backend";

function createRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

async function loadRouteModule() {
  return import("./route");
}

describe("/api/recommendations route", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchBackendMock.mockReset();
  });

  it("forwards user_id, topics, and limit on GET", async () => {
    const { GET } = await loadRouteModule();
    fetchBackendMock.mockResolvedValue({ recommendations: [] });

    const response = await GET(
      createRequest(
        "http://localhost/api/recommendations?user_id=user-1&topics=agents,llm&limit=5",
      ),
    );

    expect(response.status).toBe(200);
    expect(fetchBackendMock).toHaveBeenCalledWith("/recommendations", {
      method: "GET",
      params: {
        limit: 5,
        topics: "agents,llm",
        user_id: "user-1",
      },
    });
  });

  it("returns a typed 503 when the backend is not configured", async () => {
    const { GET } = await loadRouteModule();
    fetchBackendMock.mockRejectedValue(
      new BackendConfigurationError("BACKEND_URL environment variable not configured"),
    );

    const response = await GET(createRequest("http://localhost/api/recommendations?limit=5"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error:
        "Recommendations are unavailable until BACKEND_URL points to the ai-web-feeds backend.",
      code: "FEATURE_UNAVAILABLE",
    });
  });

  it("requires user_id on POST and forwards the interaction payload", async () => {
    const { POST } = await loadRouteModule();
    fetchBackendMock.mockResolvedValue({ tracked: true });

    const response = await POST(
      createRequest("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify({
          user_id: "user-1",
          feed_id: "feed-1",
          interaction_type: "subscribe",
          reason: "similar_topics",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchBackendMock).toHaveBeenCalledWith("/recommendations/interactions", {
      method: "POST",
      body: {
        user_id: "user-1",
        feed_id: "feed-1",
        interaction_type: "subscribe",
        reason: "similar_topics",
      },
    });
  });

  it("preserves backend status codes on POST failures", async () => {
    const { POST } = await loadRouteModule();
    fetchBackendMock.mockRejectedValue(new BackendError(404, "FEED_NOT_FOUND", "missing feed"));

    const response = await POST(
      createRequest("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify({
          user_id: "user-1",
          feed_id: "missing-feed",
          interaction_type: "dismiss",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "missing feed",
      code: "FEED_NOT_FOUND",
    });
  });
});
