import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ANON_USER_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_USER_ID = "session-user-abc123";

const { mergeMock, getUserIdentityMock } = vi.hoisted(() => ({
  mergeMock: vi.fn(),
  getUserIdentityMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/server/user-store", () => ({
  userStore: {
    merge: {
      mergeAnonymousData: mergeMock,
    },
  },
}));

vi.mock("@/lib/server/sync-events", () => ({
  recordSyncEvent: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/user-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/user-auth")>("@/lib/user-auth");
  return {
    ...actual,
    getUserIdentity: getUserIdentityMock,
  };
});

import { DatabaseNotConfiguredError } from "@/lib/server/db";
import { ANON_USER_BINDING_COOKIE } from "@/lib/user-auth";
import { POST } from "./route";

function mergeCookieHeader(fromUserId: string): string {
  return `${ANON_USER_BINDING_COOKIE}=${fromUserId}`;
}

function createNextRequest(url: string, init?: RequestInit): NextRequest {
  const request = new Request(url, init);
  Object.defineProperty(request, "nextUrl", {
    value: new URL(url),
  });
  return request as NextRequest;
}

describe("/api/user/merge route", () => {
  beforeEach(() => {
    mergeMock.mockReset();
    getUserIdentityMock.mockReset();
  });

  it("merges anonymous data into the authenticated account", async () => {
    getUserIdentityMock.mockResolvedValue({
      user_id: SESSION_USER_ID,
      source: "session",
    });
    mergeMock.mockResolvedValue({
      from_user_id: ANON_USER_ID,
      to_user_id: SESSION_USER_ID,
      merged: {
        reader_filters: 2,
        article_states: 5,
        saved_searches: 1,
        follows: 3,
        notification_preferences: 0,
      },
    });

    const response = await POST(
      createNextRequest("http://localhost/api/user/merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: mergeCookieHeader(ANON_USER_ID),
        },
        body: JSON.stringify({
          from_user_id: ANON_USER_ID,
          to_user_id: SESSION_USER_ID,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mergeMock).toHaveBeenCalledWith({
      from_user_id: ANON_USER_ID,
      to_user_id: SESSION_USER_ID,
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      merged: { reader_filters: 2, article_states: 5 },
    });
  });

  it("requires an authenticated session", async () => {
    getUserIdentityMock.mockResolvedValue({
      user_id: ANON_USER_ID,
      source: "client",
    });

    const response = await POST(
      createNextRequest("http://localhost/api/user/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_user_id: ANON_USER_ID,
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mergeMock).not.toHaveBeenCalled();
  });

  it("rejects merge when from_user_id does not match the binding cookie", async () => {
    getUserIdentityMock.mockResolvedValue({
      user_id: SESSION_USER_ID,
      source: "session",
    });

    const response = await POST(
      createNextRequest("http://localhost/api/user/merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: mergeCookieHeader("33333333-3333-4333-8333-333333333333"),
        },
        body: JSON.stringify({
          from_user_id: ANON_USER_ID,
          to_user_id: SESSION_USER_ID,
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mergeMock).not.toHaveBeenCalled();
  });

  it("returns 503 when DATABASE_URL is not configured", async () => {
    getUserIdentityMock.mockResolvedValue({
      user_id: SESSION_USER_ID,
      source: "session",
    });
    mergeMock.mockRejectedValue(new DatabaseNotConfiguredError());

    const response = await POST(
      createNextRequest("http://localhost/api/user/merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: mergeCookieHeader(ANON_USER_ID),
        },
        body: JSON.stringify({
          from_user_id: ANON_USER_ID,
        }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Account merge is unavailable until DATABASE_URL is configured.",
    });
  });
});
