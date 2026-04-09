import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBackend } from "@/lib/backend";
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

import { GET } from "./route";

const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

function createRequest(url: string, headers?: HeadersInit): NextRequest {
  const request = new Request(url, {
    method: "GET",
    headers: headers ?? {},
  });

  Object.defineProperty(request, "nextUrl", {
    value: new URL(url),
  });

  return request as NextRequest;
}

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.mocked(fetchBackend).mockReset();
  });

  it("mints anonymous binding and forwards a scoped user id", async () => {
    vi.mocked(fetchBackend).mockResolvedValue([]);

    const response = await GET(createRequest("http://localhost/api/notifications"));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(ANON_USER_BINDING_COOKIE);
    expect(fetchBackend).toHaveBeenCalledWith("/storage/notifications", {
      method: "GET",
      params: {
        user_id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
        unread_only: false,
        limit: 50,
      },
    });
  });

  it("rejects mismatched requested user id against trusted binding", async () => {
    vi.mocked(fetchBackend).mockResolvedValue([]);

    const initialResponse = await GET(createRequest("http://localhost/api/notifications"));
    const bindingCookie = initialResponse.headers.get("set-cookie");
    expect(bindingCookie).toBeTruthy();

    const response = await GET(
      createRequest(`http://localhost/api/notifications?user_id=${OTHER_USER_ID}`, {
        cookie: bindingCookie!,
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "user_id does not match request identity",
    });
  });
});
