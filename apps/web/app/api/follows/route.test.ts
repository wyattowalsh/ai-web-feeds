import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";

const { listMock, followMock, unfollowMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  followMock: vi.fn(),
  unfollowMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/server/user-store", () => ({
  userStore: {
    follows: {
      list: listMock,
      follow: followMock,
      unfollow: unfollowMock,
    },
  },
}));

import { DatabaseNotConfiguredError } from "@/lib/server/db";
import { DELETE, GET, POST } from "./route";

function createNextRequest(url: string, init?: RequestInit): NextRequest {
  const request = new Request(url, init);
  Object.defineProperty(request, "nextUrl", {
    value: new URL(url),
  });
  return request as NextRequest;
}

describe("/api/follows route", () => {
  beforeEach(() => {
    listMock.mockReset();
    followMock.mockReset();
    unfollowMock.mockReset();
  });

  it("lists follows for a valid user_id", async () => {
    listMock.mockResolvedValue([
      {
        id: 1,
        user_id: VALID_USER_ID,
        source_id: "openai-blog",
        followed_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const response = await GET(
      createNextRequest(`http://localhost/api/follows?user_id=${VALID_USER_ID}`),
    );

    expect(response.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith(VALID_USER_ID);
    await expect(response.json()).resolves.toMatchObject({
      user_id: VALID_USER_ID,
      count: 1,
      follows: [expect.objectContaining({ source_id: "openai-blog" })],
    });
  });

  it("creates a follow", async () => {
    followMock.mockResolvedValue({
      created: true,
      follow: {
        id: 2,
        user_id: VALID_USER_ID,
        source_id: "openai-blog",
        followed_at: "2026-01-02T00:00:00.000Z",
      },
    });

    const response = await POST(
      createNextRequest("http://localhost/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: VALID_USER_ID,
          source_id: "openai-blog",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(followMock).toHaveBeenCalledWith(VALID_USER_ID, "openai-blog");
  });

  it("returns already_following when follow already exists", async () => {
    followMock.mockResolvedValue({
      created: false,
      follow: {
        id: 2,
        user_id: VALID_USER_ID,
        source_id: "openai-blog",
        followed_at: "2026-01-02T00:00:00.000Z",
      },
    });

    const response = await POST(
      createNextRequest("http://localhost/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: VALID_USER_ID,
          source_id: "openai-blog",
        }),
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      already_following: true,
      source_id: "openai-blog",
    });
  });

  it("unfollows a source", async () => {
    unfollowMock.mockResolvedValue(true);

    const response = await DELETE(
      createNextRequest(
        `http://localhost/api/follows?user_id=${VALID_USER_ID}&source_id=openai-blog`,
      ),
    );

    expect(response.status).toBe(200);
    expect(unfollowMock).toHaveBeenCalledWith(VALID_USER_ID, "openai-blog");
  });

  it("returns 503 when DATABASE_URL is not configured", async () => {
    listMock.mockRejectedValue(new DatabaseNotConfiguredError());

    const response = await GET(
      createNextRequest(`http://localhost/api/follows?user_id=${VALID_USER_ID}`),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Source follows are unavailable until DATABASE_URL is configured.",
    });
  });
});
