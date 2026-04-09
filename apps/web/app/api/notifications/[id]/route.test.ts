import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBackend } from "@/lib/backend";
import { ANON_USER_BINDING_COOKIE, ANON_USER_ID_RESPONSE_HEADER } from "@/lib/user-auth";

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

import { PATCH } from "./route";

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";

function createRequest(
  url: string,
  body: Record<string, unknown>,
  headers?: HeadersInit,
): NextRequest {
  const request = new Request(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });

  Object.defineProperty(request, "nextUrl", {
    value: new URL(url),
  });

  return request as NextRequest;
}

describe("PATCH /api/notifications/[id]", () => {
  beforeEach(() => {
    vi.mocked(fetchBackend).mockReset();
  });

  it("issues anonymous binding when user identity is not provided", async () => {
    vi.mocked(fetchBackend).mockResolvedValue({ success: true });

    const response = await PATCH(
      createRequest("http://localhost/api/notifications/42", { action: "mark_read" }),
      { params: Promise.resolve({ id: "42" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(ANON_USER_BINDING_COOKIE);
    expect(fetchBackend).toHaveBeenCalledWith("/storage/notifications/42/mark_read", {
      method: "PATCH",
      params: {
        user_id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      },
    });
    await expect(response.json()).resolves.toEqual({
      success: true,
      notification_id: 42,
      action: "mark_read",
    });
  });

  it("forwards the bound query user identity to the backend mutation", async () => {
    vi.mocked(fetchBackend).mockResolvedValue({ success: true });

    const bootstrapResponse = await PATCH(
      createRequest("http://localhost/api/notifications/42", { action: "dismiss" }),
      { params: Promise.resolve({ id: "42" }) },
    );
    const bindingCookie = bootstrapResponse.headers.get("set-cookie");
    const boundUserId = bootstrapResponse.headers.get(ANON_USER_ID_RESPONSE_HEADER);

    expect(bindingCookie).toBeTruthy();
    expect(boundUserId).toBeTruthy();

    const response = await PATCH(
      createRequest(
        `http://localhost/api/notifications/42?user_id=${VALID_USER_ID}`,
        {
          action: "dismiss",
        },
        { cookie: bindingCookie! },
      ),
      { params: Promise.resolve({ id: "42" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "user_id does not match request identity",
    });

    const matchingResponse = await PATCH(
      createRequest(
        `http://localhost/api/notifications/42?user_id=${boundUserId}`,
        { action: "dismiss" },
        { cookie: bindingCookie! },
      ),
      { params: Promise.resolve({ id: "42" }) },
    );

    expect(fetchBackend).toHaveBeenCalledWith("/storage/notifications/42/dismiss", {
      method: "PATCH",
      params: {
        user_id: boundUserId,
      },
    });
    expect(matchingResponse.status).toBe(200);
    await expect(matchingResponse.json()).resolves.toEqual({
      success: true,
      notification_id: 42,
      action: "dismiss",
    });
  });

  it("forwards the bound body user identity to the backend mutation", async () => {
    vi.mocked(fetchBackend).mockResolvedValue({ success: true });

    const bootstrapResponse = await PATCH(
      createRequest("http://localhost/api/notifications/7", {
        action: "mark_read",
      }),
      { params: Promise.resolve({ id: "7" }) },
    );
    const bindingCookie = bootstrapResponse.headers.get("set-cookie");
    const boundUserId = bootstrapResponse.headers.get(ANON_USER_ID_RESPONSE_HEADER);

    expect(bindingCookie).toBeTruthy();
    expect(boundUserId).toBeTruthy();

    const response = await PATCH(
      createRequest(
        "http://localhost/api/notifications/7",
        {
          action: "mark_read",
          user_id: boundUserId!,
        },
        { cookie: bindingCookie! },
      ),
      { params: Promise.resolve({ id: "7" }) },
    );

    expect(fetchBackend).toHaveBeenCalledWith("/storage/notifications/7/mark_read", {
      method: "PATCH",
      params: {
        user_id: boundUserId,
      },
    });

    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects a client-supplied user_id before a binding cookie exists", async () => {
    vi.mocked(fetchBackend).mockResolvedValue({ success: true });

    const response = await PATCH(
      createRequest("http://localhost/api/notifications/7", {
        action: "mark_read",
        user_id: VALID_USER_ID,
      }),
      { params: Promise.resolve({ id: "7" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "user_id does not match request identity",
    });
    expect(fetchBackend).not.toHaveBeenCalled();
  });

  it("rejects mismatched user_id when a binding cookie is already established", async () => {
    vi.mocked(fetchBackend).mockResolvedValue({ success: true });
    const initialResponse = await PATCH(
      createRequest("http://localhost/api/notifications/42", { action: "dismiss" }),
      { params: Promise.resolve({ id: "42" }) },
    );
    const bindingCookie = initialResponse.headers.get("set-cookie");

    expect(bindingCookie).toBeTruthy();

    const mismatchedResponse = await PATCH(
      createRequest(
        "http://localhost/api/notifications/42?user_id=22222222-2222-4222-8222-222222222222",
        { action: "dismiss" },
        { cookie: bindingCookie! },
      ),
      { params: Promise.resolve({ id: "42" }) },
    );

    expect(mismatchedResponse.status).toBe(403);
    await expect(mismatchedResponse.json()).resolves.toEqual({
      error: "user_id does not match request identity",
    });
    expect(fetchBackend).toHaveBeenCalledTimes(1);
  });
});
