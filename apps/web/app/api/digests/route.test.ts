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

import { GET, POST } from "./route";

const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

function createRequest(url: string, headers?: HeadersInit, init?: RequestInit): NextRequest {
  const request = new Request(url, {
    method: "GET",
    headers: headers ?? {},
    ...init,
  });

  Object.defineProperty(request, "nextUrl", {
    value: new URL(url),
  });

  return request as NextRequest;
}

describe("GET /api/digests", () => {
  beforeEach(() => {
    vi.mocked(fetchBackend).mockReset();
  });

  it("mints anonymous binding and forwards a scoped user id", async () => {
    vi.mocked(fetchBackend).mockResolvedValue([]);

    const response = await GET(createRequest("http://localhost/api/digests"));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(ANON_USER_BINDING_COOKIE);
    expect(fetchBackend).toHaveBeenCalledWith("/storage/digests", {
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

    const initialResponse = await GET(createRequest("http://localhost/api/digests"));
    const bindingCookie = initialResponse.headers.get("set-cookie");
    expect(bindingCookie).toBeTruthy();

    const response = await GET(
      createRequest(`http://localhost/api/digests?user_id=${OTHER_USER_ID}`, {
        cookie: bindingCookie!,
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "user_id does not match request identity",
    });
  });
});

describe("POST /api/digests", () => {
  beforeEach(() => {
    vi.mocked(fetchBackend).mockReset();
  });

  it("fills the default cron for daily schedules", async () => {
    vi.mocked(fetchBackend).mockResolvedValue({ id: 1, schedule_type: "daily" });

    const response = await POST(
      createRequest(
        "http://localhost/api/digests",
        { "content-type": "application/json" },
        {
          method: "POST",
          body: JSON.stringify({
            email: "user@example.com",
            schedule_type: "daily",
            timezone: "America/New_York",
          }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(fetchBackend).toHaveBeenCalledWith("/storage/digests", {
      method: "POST",
      body: {
        user_id: expect.any(String),
        email: "user@example.com",
        schedule_type: "daily",
        schedule_cron: "0 9 * * *",
        timezone: "America/New_York",
      },
    });
  });

  it("requires schedule_cron for custom schedules", async () => {
    const response = await POST(
      createRequest(
        "http://localhost/api/digests",
        { "content-type": "application/json" },
        {
          method: "POST",
          body: JSON.stringify({
            email: "user@example.com",
            schedule_type: "custom",
          }),
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "schedule_cron is required for custom schedules",
    });
  });

  it("rejects invalid cron expressions", async () => {
    const response = await POST(
      createRequest(
        "http://localhost/api/digests",
        { "content-type": "application/json" },
        {
          method: "POST",
          body: JSON.stringify({
            email: "user@example.com",
            schedule_type: "custom",
            schedule_cron: "bad cron",
          }),
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid schedule_cron",
    });
  });

  it("rejects invalid timezones", async () => {
    const response = await POST(
      createRequest(
        "http://localhost/api/digests",
        { "content-type": "application/json" },
        {
          method: "POST",
          body: JSON.stringify({
            email: "user@example.com",
            schedule_type: "weekly",
            timezone: "Mars/Olympus",
          }),
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid timezone",
    });
  });
});
