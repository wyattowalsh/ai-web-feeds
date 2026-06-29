import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchBackendMock, getSqlMock, recordRecommendationInteractionMock, getUserIdentityMock } =
  vi.hoisted(() => ({
    fetchBackendMock: vi.fn(),
    getSqlMock: vi.fn(() => null),
    recordRecommendationInteractionMock: vi.fn(),
    getUserIdentityMock: vi.fn(),
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

vi.mock("@/lib/server/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/db")>("@/lib/server/db");
  return {
    ...actual,
    getSql: getSqlMock,
  };
});

vi.mock("@/lib/user-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/user-auth")>("@/lib/user-auth");
  return {
    ...actual,
    getUserIdentity: getUserIdentityMock,
  };
});

vi.mock("@/lib/server/recommendation-interactions", () => ({
  recordRecommendationInteraction: recordRecommendationInteractionMock,
}));

import { BackendConfigurationError, BackendError } from "@/lib/backend";

function createRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

async function loadRouteModule() {
  return import("./route");
}

describe("/api/recommendations route", () => {
  const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";
  const SESSION_USER_ID = "session-user-abc123";
  const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.resetModules();
    fetchBackendMock.mockReset();
    getSqlMock.mockReset();
    getSqlMock.mockReturnValue(null);
    recordRecommendationInteractionMock.mockReset();
    getUserIdentityMock.mockReset();
    getUserIdentityMock.mockImplementation(async (_request, candidateUserId?: string | null) => {
      const userId = candidateUserId?.trim();
      if (userId && /^[0-9a-f-]{36}$/i.test(userId)) {
        return { user_id: userId, source: "client" as const };
      }
      return { user_id: "anonymous", source: "anonymous" as const };
    });
  });

  it("forwards user_id, topics, and limit on GET", async () => {
    const { GET } = await loadRouteModule();
    fetchBackendMock.mockResolvedValue({ recommendations: [] });

    const response = await GET(
      createRequest(
        `http://localhost/api/recommendations?user_id=${VALID_USER_ID}&topics=agents,llm&limit=5`,
      ),
    );

    expect(response.status).toBe(200);
    expect(fetchBackendMock).toHaveBeenCalledWith("/recommendations", {
      method: "GET",
      params: {
        limit: 5,
        topics: "agents,llm",
        user_id: VALID_USER_ID,
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
          user_id: VALID_USER_ID,
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
        user_id: VALID_USER_ID,
        feed_id: "feed-1",
        interaction_type: "subscribe",
        reason: "similar_topics",
      },
    });
  });

  it("persists recommendation interactions to Neon when DATABASE_URL is configured", async () => {
    const { POST } = await loadRouteModule();
    getSqlMock.mockReturnValue(vi.fn() as never);
    recordRecommendationInteractionMock.mockResolvedValue({
      id: "interaction-1",
      user_id: VALID_USER_ID,
      feed_id: "feed-1",
      interaction_type: "subscribe",
      context: { reason: "similar_topics" },
      timestamp: "2026-06-25T12:00:00.000Z",
    });

    const response = await POST(
      createRequest("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify({
          user_id: VALID_USER_ID,
          feed_id: "feed-1",
          interaction_type: "subscribe",
          reason: "similar_topics",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(recordRecommendationInteractionMock).toHaveBeenCalled();
    expect(fetchBackendMock).not.toHaveBeenCalled();
  });

  it("preserves backend status codes on POST failures", async () => {
    const { POST } = await loadRouteModule();
    fetchBackendMock.mockRejectedValue(new BackendError(404, "FEED_NOT_FOUND", "missing feed"));

    const response = await POST(
      createRequest("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify({
          user_id: VALID_USER_ID,
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

  it("returns 400 when session user omits feed_id", async () => {
    const { POST } = await loadRouteModule();
    getUserIdentityMock.mockResolvedValue({
      user_id: SESSION_USER_ID,
      source: "session",
    });

    const response = await POST(
      createRequest("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify({ interaction_type: "view" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing required fields: feed_id, interaction_type",
    });
    expect(fetchBackendMock).not.toHaveBeenCalled();
    expect(recordRecommendationInteractionMock).not.toHaveBeenCalled();
  });

  it("rejects GET requests that spoof a different session user_id", async () => {
    const { GET } = await loadRouteModule();
    getUserIdentityMock.mockResolvedValue({
      user_id: SESSION_USER_ID,
      source: "session",
    });

    const response = await GET(
      createRequest(`http://localhost/api/recommendations?user_id=${OTHER_USER_ID}`),
    );

    expect(response.status).toBe(403);
    expect(fetchBackendMock).not.toHaveBeenCalled();
  });

  it("rejects POST interactions that spoof a different session user_id", async () => {
    const { POST } = await loadRouteModule();
    getUserIdentityMock.mockResolvedValue({
      user_id: SESSION_USER_ID,
      source: "session",
    });

    const response = await POST(
      createRequest("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify({
          user_id: OTHER_USER_ID,
          feed_id: "feed-1",
          interaction_type: "subscribe",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(403);
    expect(fetchBackendMock).not.toHaveBeenCalled();
    expect(recordRecommendationInteractionMock).not.toHaveBeenCalled();
  });
});
