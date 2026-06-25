import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertDbConfigured } from "@/lib/server/db";

import { followSource, listFollows, unfollowSource } from "./follows";

vi.mock("@/lib/server/db", () => ({
  assertDbConfigured: vi.fn(),
}));

describe("follows store", () => {
  const sql = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertDbConfigured).mockReturnValue(sql as never);
  });

  it("lists follows for a user", async () => {
    sql.mockResolvedValueOnce([
      {
        id: 7,
        user_id: "user-1",
        source_id: "openai-blog",
        followed_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const rows = await listFollows("user-1");

    expect(rows[0]?.source_id).toBe("openai-blog");
  });

  it("creates a follow when not already following", async () => {
    sql.mockResolvedValueOnce([
      {
        id: 8,
        user_id: "user-1",
        source_id: "openai-blog",
        followed_at: "2026-01-02T00:00:00.000Z",
      },
    ]);

    const result = await followSource("user-1", "openai-blog");

    expect(result.created).toBe(true);
    expect(result.follow.source_id).toBe("openai-blog");
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("returns existing follow when already following", async () => {
    sql.mockResolvedValueOnce([]);
    sql.mockResolvedValueOnce([
      {
        id: 8,
        user_id: "user-1",
        source_id: "openai-blog",
        followed_at: "2026-01-02T00:00:00.000Z",
      },
    ]);

    const result = await followSource("user-1", "openai-blog");

    expect(result.created).toBe(false);
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("unfollows a source", async () => {
    sql.mockResolvedValueOnce([{ id: 8 }]);

    const removed = await unfollowSource("user-1", "openai-blog");

    expect(removed).toBe(true);
  });
});
