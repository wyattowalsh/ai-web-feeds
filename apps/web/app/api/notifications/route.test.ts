import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";

const { listMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/server/user-store", () => ({
  userStore: {
    notifications: {
      list: listMock,
      markRead: vi.fn(),
      dismiss: vi.fn(),
    },
  },
}));

import { DatabaseNotConfiguredError } from "@/lib/server/db";
import { GET } from "./route";

function createNextRequest(url: string): NextRequest {
  const request = new Request(url);
  Object.defineProperty(request, "nextUrl", {
    value: new URL(url),
  });
  return request as NextRequest;
}

describe("GET /api/notifications", () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it("rejects requests without a valid user identity", async () => {
    const response = await GET(createNextRequest("http://localhost/api/notifications"));

    expect(response.status).toBe(400);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("lists notifications with unread_only and limit", async () => {
    listMock.mockResolvedValue([
      {
        id: 42,
        user_id: VALID_USER_ID,
        type: "new_article",
        title: "New article",
        message: "Feed published",
        action_url: null,
        context_data: {},
        read_at: null,
        dismissed_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const response = await GET(
      createNextRequest(
        `http://localhost/api/notifications?user_id=${VALID_USER_ID}&unread_only=true&limit=25`,
      ),
    );

    expect(response.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith(VALID_USER_ID, {
      unreadOnly: true,
      limit: 25,
    });
    await expect(response.json()).resolves.toMatchObject({
      user_id: VALID_USER_ID,
      count: 1,
      notifications: [expect.objectContaining({ id: 42 })],
    });
  });

  it("returns 503 when DATABASE_URL is not configured", async () => {
    listMock.mockRejectedValue(new DatabaseNotConfiguredError());

    const response = await GET(
      createNextRequest(`http://localhost/api/notifications?user_id=${VALID_USER_ID}`),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Notifications are unavailable until DATABASE_URL is configured.",
    });
  });
});
