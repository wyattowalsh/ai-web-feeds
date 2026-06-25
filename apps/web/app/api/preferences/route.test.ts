import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";

const { getMock, upsertMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/server/user-store", () => ({
  userStore: {
    preferences: {
      get: getMock,
      upsert: upsertMock,
    },
  },
}));

import { DatabaseNotConfiguredError } from "@/lib/server/db";
import { GET, POST } from "./route";

function createNextRequest(url: string, init?: RequestInit): NextRequest {
  const request = new Request(url, init);
  Object.defineProperty(request, "nextUrl", {
    value: new URL(url),
  });
  return request as NextRequest;
}

describe("/api/preferences route", () => {
  beforeEach(() => {
    getMock.mockReset();
    upsertMock.mockReset();
  });

  it("returns preferences for a valid user_id", async () => {
    getMock.mockResolvedValue([
      {
        id: 1,
        user_id: VALID_USER_ID,
        feed_id: null,
        delivery_method: "in_app",
        frequency: "daily",
        quiet_hours_start: null,
        quiet_hours_end: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const response = await GET(
      createNextRequest(`http://localhost/api/preferences?user_id=${VALID_USER_ID}`),
    );

    expect(response.status).toBe(200);
    expect(getMock).toHaveBeenCalledWith(VALID_USER_ID);
    await expect(response.json()).resolves.toMatchObject({
      user_id: VALID_USER_ID,
      preferences: [expect.objectContaining({ delivery_method: "in_app" })],
    });
  });

  it("upserts a preference", async () => {
    upsertMock.mockResolvedValue({
      id: 2,
      user_id: VALID_USER_ID,
      feed_id: "feed-1",
      delivery_method: "websocket",
      frequency: "instant",
      quiet_hours_start: null,
      quiet_hours_end: null,
      created_at: "2026-01-02T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    });

    const response = await POST(
      createNextRequest("http://localhost/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: VALID_USER_ID,
          feed_id: "feed-1",
          delivery_method: "websocket",
          frequency: "instant",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith({
      user_id: VALID_USER_ID,
      feed_id: "feed-1",
      delivery_method: "websocket",
      frequency: "instant",
      quiet_hours_start: null,
      quiet_hours_end: null,
    });
  });

  it("returns 503 when DATABASE_URL is not configured", async () => {
    getMock.mockRejectedValue(new DatabaseNotConfiguredError());

    const response = await GET(
      createNextRequest(`http://localhost/api/preferences?user_id=${VALID_USER_ID}`),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Notification preferences are unavailable until DATABASE_URL is configured.",
    });
  });
});
