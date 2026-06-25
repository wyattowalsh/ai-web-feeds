import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertDbConfigured } from "@/lib/server/db";

import { createSavedSearch, deleteSavedSearch, listSavedSearches } from "./saved-searches";

vi.mock("@/lib/server/db", () => ({
  assertDbConfigured: vi.fn(),
}));

describe("saved-searches store", () => {
  const sql = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertDbConfigured).mockReturnValue(sql as never);
  });

  it("lists saved searches for a user", async () => {
    sql.mockResolvedValueOnce([
      {
        id: "11111111-1111-4111-8111-111111111111",
        user_id: "user-1",
        search_name: "LLM news",
        query_text: "llm",
        filters: { topics: ["llm"] },
        created_at: "2026-01-01T00:00:00.000Z",
        last_used_at: "2026-01-02T00:00:00.000Z",
      },
    ]);

    const rows = await listSavedSearches("user-1");

    expect(sql).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        user_id: "user-1",
        search_name: "LLM news",
        query_text: "llm",
        filters: { topics: ["llm"] },
        created_at: "2026-01-01T00:00:00.000Z",
        last_used_at: "2026-01-02T00:00:00.000Z",
      },
    ]);
  });

  it("creates a saved search", async () => {
    sql.mockResolvedValueOnce([
      {
        id: "22222222-2222-4222-8222-222222222222",
        user_id: "user-1",
        search_name: "Agents",
        query_text: "agent",
        filters: {},
        created_at: "2026-01-03T00:00:00.000Z",
        last_used_at: "2026-01-03T00:00:00.000Z",
      },
    ]);

    const created = await createSavedSearch({
      user_id: "user-1",
      search_name: "Agents",
      query_text: "agent",
    });

    expect(created.id).toBe("22222222-2222-4222-8222-222222222222");
    expect(created.filters).toEqual({});
  });

  it("deletes a saved search scoped to user", async () => {
    sql.mockResolvedValueOnce([{ id: "22222222-2222-4222-8222-222222222222" }]);

    const deleted = await deleteSavedSearch("user-1", "22222222-2222-4222-8222-222222222222");

    expect(deleted).toBe(true);
  });
});
