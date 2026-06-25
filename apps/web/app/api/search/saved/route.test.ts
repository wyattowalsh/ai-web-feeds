import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";

const { listMock, createMock, deleteMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  createMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/server/user-store", () => ({
  userStore: {
    savedSearches: {
      list: listMock,
      create: createMock,
      delete: deleteMock,
    },
  },
}));

import { DatabaseNotConfiguredError } from "@/lib/server/db";
import { DELETE, GET, POST } from "./route";

describe("/api/search/saved route", () => {
  beforeEach(() => {
    listMock.mockReset();
    createMock.mockReset();
    deleteMock.mockReset();
  });

  it("lists saved searches for a valid user_id", async () => {
    listMock.mockResolvedValue([
      {
        id: "22222222-2222-4222-8222-222222222222",
        user_id: VALID_USER_ID,
        search_name: "Agents",
        query_text: "agent",
        filters: {},
        created_at: "2026-01-01T00:00:00.000Z",
        last_used_at: "2026-01-02T00:00:00.000Z",
      },
    ]);

    const response = await GET(
      new Request(`http://localhost/api/search/saved?user_id=${VALID_USER_ID}`),
    );

    expect(response.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith(VALID_USER_ID);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ search_name: "Agents" }),
    ]);
  });

  it("creates a saved search", async () => {
    createMock.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      user_id: VALID_USER_ID,
      search_name: "LLM",
      query_text: "llm",
      filters: { topics: ["llm"] },
      created_at: "2026-01-03T00:00:00.000Z",
      last_used_at: "2026-01-03T00:00:00.000Z",
    });

    const response = await POST(
      new Request("http://localhost/api/search/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: VALID_USER_ID,
          search_name: "LLM",
          query_text: "llm",
          filters: { topics: ["llm"] },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith({
      user_id: VALID_USER_ID,
      search_name: "LLM",
      query_text: "llm",
      filters: { topics: ["llm"] },
    });
  });

  it("deletes a saved search", async () => {
    deleteMock.mockResolvedValue(true);

    const response = await DELETE(
      new Request(
        `http://localhost/api/search/saved?id=22222222-2222-4222-8222-222222222222&user_id=${VALID_USER_ID}`,
      ),
    );

    expect(response.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith(VALID_USER_ID, "22222222-2222-4222-8222-222222222222");
  });

  it("returns 503 when DATABASE_URL is not configured", async () => {
    listMock.mockRejectedValue(new DatabaseNotConfiguredError());

    const response = await GET(
      new Request(`http://localhost/api/search/saved?user_id=${VALID_USER_ID}`),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Saved searches are unavailable until DATABASE_URL is configured.",
    });
  });
});
