import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";
const FILTER_ID = "33333333-3333-4333-8333-333333333333";

const { listMock, saveMock, deleteMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  saveMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/server/user-store", () => ({
  userStore: {
    readerFilters: {
      list: listMock,
      save: saveMock,
      delete: deleteMock,
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

const samplePayload = {
  query: "agent",
  feedIds: ["feed-1"],
  sourceType: "blog",
  topics: ["agents"],
  verified: true,
  sort: "latest" as const,
  readerView: "unread" as const,
};

describe("/api/user/filters route", () => {
  beforeEach(() => {
    listMock.mockReset();
    saveMock.mockReset();
    deleteMock.mockReset();
  });

  it("lists saved reader filters", async () => {
    listMock.mockResolvedValue([
      {
        id: FILTER_ID,
        user_id: VALID_USER_ID,
        filter_name: "Unread agents",
        payload: samplePayload,
        schema_version: "reader-filter-v1",
        use_count: 1,
        pinned: false,
        is_default: true,
        created_at: "2026-01-01T00:00:00.000Z",
        last_used_at: "2026-01-02T00:00:00.000Z",
      },
    ]);

    const response = await GET(
      createNextRequest(`http://localhost/api/user/filters?user_id=${VALID_USER_ID}`),
    );

    expect(response.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith(VALID_USER_ID);
    await expect(response.json()).resolves.toMatchObject({
      user_id: VALID_USER_ID,
      count: 1,
      filters: [expect.objectContaining({ filter_name: "Unread agents" })],
    });
  });

  it("saves a reader filter", async () => {
    saveMock.mockResolvedValue({
      id: FILTER_ID,
      user_id: VALID_USER_ID,
      filter_name: "Unread agents",
      payload: samplePayload,
      schema_version: "reader-filter-v1",
      use_count: 0,
      pinned: true,
      is_default: false,
      created_at: "2026-01-03T00:00:00.000Z",
      last_used_at: "2026-01-03T00:00:00.000Z",
    });

    const response = await POST(
      createNextRequest("http://localhost/api/user/filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: VALID_USER_ID,
          filter_name: "Unread agents",
          payload: samplePayload,
          pinned: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: VALID_USER_ID,
        filter_name: "Unread agents",
        pinned: true,
      }),
    );
  });

  it("deletes a reader filter", async () => {
    deleteMock.mockResolvedValue(true);

    const response = await DELETE(
      createNextRequest(
        `http://localhost/api/user/filters?user_id=${VALID_USER_ID}&id=${FILTER_ID}`,
      ),
    );

    expect(response.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith(VALID_USER_ID, FILTER_ID);
  });

  it("returns 503 when DATABASE_URL is not configured", async () => {
    listMock.mockRejectedValue(new DatabaseNotConfiguredError());

    const response = await GET(
      createNextRequest(`http://localhost/api/user/filters?user_id=${VALID_USER_ID}`),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Saved reader filters are unavailable until DATABASE_URL is configured.",
    });
  });
});
