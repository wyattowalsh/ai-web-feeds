import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackendError, fetchBackend } from "@/lib/backend";
import { ANON_USER_BINDING_COOKIE } from "@/lib/user-auth";

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

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

function createRequest(url: string, init?: RequestInit): NextRequest {
  const request = new Request(url, {
    method: "GET",
    ...init,
  });

  Object.defineProperty(request, "nextUrl", {
    value: new URL(url),
  });

  return request as NextRequest;
}

describe("GET /api/follows", () => {
  beforeEach(() => {
    vi.mocked(fetchBackend).mockReset();
  });

  it("mints anonymous binding and forwards a scoped user id", async () => {
    vi.mocked(fetchBackend).mockResolvedValue([]);

    const response = await GET(createRequest("http://localhost/api/follows"));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(ANON_USER_BINDING_COOKIE);
    expect(fetchBackend).toHaveBeenCalledWith("/storage/follows", {
      method: "GET",
      params: {
        user_id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      },
    });
  });

  it("rejects mismatched requested user id against trusted binding", async () => {
    vi.mocked(fetchBackend).mockResolvedValue([]);

    const initialResponse = await GET(createRequest("http://localhost/api/follows"));
    const bindingCookie = initialResponse.headers.get("set-cookie");
    expect(bindingCookie).toBeTruthy();

    const response = await GET(
      createRequest(`http://localhost/api/follows?user_id=${OTHER_USER_ID}`, {
        cookie: bindingCookie!,
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "user_id does not match request identity",
    });
  });

  it("rejects client-supplied user_id before an anonymous binding exists", async () => {
    vi.mocked(fetchBackend).mockResolvedValue([]);

    const response = await GET(
      createRequest(`http://localhost/api/follows?user_id=${VALID_USER_ID}`),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "user_id does not match request identity",
    });
    expect(fetchBackend).not.toHaveBeenCalled();
  });

  it("returns already_following when the backend reports a 409 conflict", async () => {
    vi.mocked(fetchBackend).mockRejectedValue(
      new BackendError(409, "ALREADY_FOLLOWING", "Feed is already followed"),
    );

    const response = await POST(
      createRequest("http://localhost/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feed_id: "feed-1",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        already_following: true,
      }),
    );
  });
});
