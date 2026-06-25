import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";

const { listMock, upsertMock, upsertManyMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  upsertMock: vi.fn(),
  upsertManyMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/server/user-store", () => ({
  toClientArticleState: (record: {
    article_key: string;
    read_at: string | null;
    starred_at: string | null;
    archived_at: string | null;
    saved_at: string | null;
    read_duration_ms: number | null;
    scroll_depth: number | null;
    opened_from: string | null;
    updated_at: string;
  }) => ({
    article_key: record.article_key,
    read: record.read_at != null,
    starred: record.starred_at != null,
    archived: record.archived_at != null,
    bookmarked: record.saved_at != null,
    read_duration_ms: record.read_duration_ms,
    scroll_depth: record.scroll_depth,
    opened_from: record.opened_from,
    updated_at: record.updated_at,
  }),
  userStore: {
    articleStates: {
      list: listMock,
      upsert: upsertMock,
      upsertMany: upsertManyMock,
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

const sampleRecord = {
  id: "55555555-5555-4555-8555-555555555555",
  user_id: VALID_USER_ID,
  article_key: "feed-1:https://example.com/post",
  article_id: null,
  read_at: "2026-01-01T00:00:00.000Z",
  saved_at: null,
  starred_at: null,
  archived_at: null,
  annotation_ids: [],
  read_duration_ms: 1200,
  scroll_depth: 0.75,
  opened_from: "reader",
  updated_at: "2026-01-02T00:00:00.000Z",
};

describe("/api/user/state route", () => {
  beforeEach(() => {
    listMock.mockReset();
    upsertMock.mockReset();
    upsertManyMock.mockReset();
  });

  it("lists article states for a user", async () => {
    listMock.mockResolvedValue([sampleRecord]);

    const response = await GET(
      createNextRequest(`http://localhost/api/user/state?user_id=${VALID_USER_ID}`),
    );

    expect(response.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith(VALID_USER_ID, { since: undefined, limit: 500 });
    await expect(response.json()).resolves.toMatchObject({
      user_id: VALID_USER_ID,
      count: 1,
      states: [
        expect.objectContaining({
          article_key: "feed-1:https://example.com/post",
          read: true,
        }),
      ],
    });
  });

  it("upserts a single article state", async () => {
    upsertMock.mockResolvedValue(sampleRecord);

    const response = await POST(
      createNextRequest("http://localhost/api/user/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: VALID_USER_ID,
          article_key: "feed-1:https://example.com/post",
          read: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith({
      user_id: VALID_USER_ID,
      article_key: "feed-1:https://example.com/post",
      read: true,
    });
  });

  it("upserts a batch of article states", async () => {
    upsertManyMock.mockResolvedValue({
      upserted: 2,
      states: [sampleRecord, { ...sampleRecord, article_key: "feed-2:https://example.com/two" }],
    });

    const response = await POST(
      createNextRequest("http://localhost/api/user/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: VALID_USER_ID,
          states: [
            { article_key: "feed-1:https://example.com/post", read: true },
            { article_key: "feed-2:https://example.com/two", starred: true },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(upsertManyMock).toHaveBeenCalledWith(VALID_USER_ID, [
      { article_key: "feed-1:https://example.com/post", read: true },
      { article_key: "feed-2:https://example.com/two", starred: true },
    ]);
    await expect(response.json()).resolves.toMatchObject({ upserted: 2 });
  });

  it("returns 503 when DATABASE_URL is not configured", async () => {
    listMock.mockRejectedValue(new DatabaseNotConfiguredError());

    const response = await GET(
      createNextRequest(`http://localhost/api/user/state?user_id=${VALID_USER_ID}`),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Article state sync is unavailable until DATABASE_URL is configured.",
    });
  });
});
