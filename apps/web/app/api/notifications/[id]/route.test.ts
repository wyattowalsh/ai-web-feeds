import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";

const { markReadMock, dismissMock, getUserIdentityMock } = vi.hoisted(() => ({
  markReadMock: vi.fn(),
  dismissMock: vi.fn(),
  getUserIdentityMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/user-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/user-auth")>("@/lib/user-auth");
  return {
    ...actual,
    getUserIdentity: getUserIdentityMock,
  };
});

vi.mock("@/lib/server/user-store", () => ({
  userStore: {
    notifications: {
      list: vi.fn(),
      markRead: markReadMock,
      dismiss: dismissMock,
    },
  },
}));

import { DatabaseNotConfiguredError } from "@/lib/server/db";
import { PATCH } from "./route";

function createRequest(url: string, body: Record<string, unknown>): NextRequest {
  const request = new Request(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
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
    markReadMock.mockReset();
    dismissMock.mockReset();
    getUserIdentityMock.mockReset();
    getUserIdentityMock.mockImplementation(async (_request, candidateUserId?: string | null) => {
      const userId = candidateUserId?.trim();
      if (userId && /^[0-9a-f-]{36}$/i.test(userId)) {
        return { user_id: userId, source: "client" as const };
      }
      return { user_id: "anonymous", source: "anonymous" as const };
    });
  });

  it("rejects notification updates without a valid user identity", async () => {
    const response = await PATCH(
      createRequest("http://localhost/api/notifications/42", { action: "mark_read" }),
      { params: Promise.resolve({ id: "42" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing or invalid user_id",
    });
    expect(markReadMock).not.toHaveBeenCalled();
    expect(dismissMock).not.toHaveBeenCalled();
  });

  it("dismisses a notification for the resolved user identity", async () => {
    dismissMock.mockResolvedValue(true);

    const response = await PATCH(
      createRequest(`http://localhost/api/notifications/42?user_id=${VALID_USER_ID}`, {
        action: "dismiss",
      }),
      { params: Promise.resolve({ id: "42" }) },
    );

    expect(dismissMock).toHaveBeenCalledWith(VALID_USER_ID, 42);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      notification_id: 42,
      action: "dismiss",
    });
  });

  it("marks a notification read from the body user identity", async () => {
    markReadMock.mockResolvedValue(true);

    await PATCH(
      createRequest("http://localhost/api/notifications/7", {
        action: "mark_read",
        user_id: VALID_USER_ID,
      }),
      { params: Promise.resolve({ id: "7" }) },
    );

    expect(markReadMock).toHaveBeenCalledWith(VALID_USER_ID, 7);
  });

  it("returns 503 when DATABASE_URL is not configured", async () => {
    markReadMock.mockRejectedValue(new DatabaseNotConfiguredError());

    const response = await PATCH(
      createRequest("http://localhost/api/notifications/7", {
        action: "mark_read",
        user_id: VALID_USER_ID,
      }),
      { params: Promise.resolve({ id: "7" }) },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Notifications are unavailable until DATABASE_URL is configured.",
    });
  });
});
