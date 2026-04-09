import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackendError, fetchBackend } from "@/lib/backend";
import { ANON_USER_BINDING_COOKIE, ANON_USER_ID_RESPONSE_HEADER } from "@/lib/user-auth";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/backend", async () => {
  const actual = await vi.importActual<typeof import("@/lib/backend")>("@/lib/backend");
  return {
    ...actual,
    fetchBackend: vi.fn(),
  };
});

import { GET, POST } from "./route";

function createRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

describe("/api/recommendations route", () => {
  beforeEach(() => {
    vi.mocked(fetchBackend).mockReset();
  });

  it("forwards bound user id on GET and sets binding cookie", async () => {
    vi.mocked(fetchBackend).mockResolvedValue({ recommendations: [] });

    const response = await GET(
      createRequest("http://localhost/api/recommendations?topics=ml,vision"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(ANON_USER_BINDING_COOKIE);
    expect(fetchBackend).toHaveBeenCalledWith("/recommendations", {
      method: "GET",
      params: expect.objectContaining({
        topics: "ml,vision",
        user_id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      }),
    });
  });

  it("forwards bound user id on POST interactions", async () => {
    vi.mocked(fetchBackend).mockResolvedValue({ success: true });

    const response = await POST(
      createRequest("http://localhost/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feed_id: "feed-1",
          interaction_type: "click",
          reason: "similar_topics",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(ANON_USER_BINDING_COOKIE);
    expect(fetchBackend).toHaveBeenCalledWith("/recommendations/interactions", {
      method: "POST",
      body: expect.objectContaining({
        feed_id: "feed-1",
        interaction_type: "click",
        user_id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      }),
    });
  });

  it("preserves backend status codes for failures", async () => {
    vi.mocked(fetchBackend).mockRejectedValue(
      new BackendError(429, "RATE_LIMITED", "Too many recommendation requests"),
    );

    const response = await GET(createRequest("http://localhost/api/recommendations"));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "Too many recommendation requests",
      code: "RATE_LIMITED",
    });
  });

  it("rejects a client-supplied user_id before a binding cookie exists", async () => {
    vi.mocked(fetchBackend).mockResolvedValue({ recommendations: [] });

    const response = await GET(
      createRequest(
        "http://localhost/api/recommendations?user_id=11111111-1111-4111-8111-111111111111",
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "user_id does not match request identity",
    });
    expect(fetchBackend).not.toHaveBeenCalled();
  });

  it("accepts a matching user_id after anonymous binding is established", async () => {
    vi.mocked(fetchBackend).mockResolvedValue({ recommendations: [] });

    const bootstrapResponse = await GET(createRequest("http://localhost/api/recommendations"));
    const bindingCookie = bootstrapResponse.headers.get("set-cookie");
    const boundUserId = bootstrapResponse.headers.get(ANON_USER_ID_RESPONSE_HEADER);

    expect(bindingCookie).toContain(ANON_USER_BINDING_COOKIE);
    expect(boundUserId).toBeTruthy();

    const response = await GET(
      createRequest(`http://localhost/api/recommendations?user_id=${boundUserId}`, {
        headers: {
          cookie: bindingCookie!,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchBackend).toHaveBeenLastCalledWith("/recommendations", {
      method: "GET",
      params: expect.objectContaining({
        user_id: boundUserId,
      }),
    });
  });
});
