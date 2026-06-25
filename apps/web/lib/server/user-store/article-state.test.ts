import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertDbConfigured } from "@/lib/server/db";

import {
  listArticleStates,
  resetUserArticleStatesTableCacheForTests,
  toClientArticleState,
  upsertArticleState,
} from "./article-state";

vi.mock("@/lib/server/db", () => ({
  assertDbConfigured: vi.fn(),
}));

describe("article-state store", () => {
  const sql = Object.assign(vi.fn(), {
    transaction: vi.fn().mockResolvedValue([]),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetUserArticleStatesTableCacheForTests();
    vi.mocked(assertDbConfigured).mockReturnValue(sql as never);
    sql.mockResolvedValue([]);
    sql.transaction.mockResolvedValue([]);
  });

  function warmTableMocks(): void {
    for (let index = 0; index < 7; index += 1) {
      sql.mockResolvedValueOnce([]);
    }
  }

  function mockQueryResults(...rowSets: Record<string, unknown>[][]): void {
    for (const rows of rowSets) {
      sql.mockResolvedValueOnce(rows);
    }
  }

  it("lists article states for a user", async () => {
    warmTableMocks();
    mockQueryResults([
      {
        id: "55555555-5555-4555-8555-555555555555",
        user_id: "user-1",
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
      },
    ]);

    const rows = await listArticleStates("user-1");

    expect(rows[0]?.article_key).toBe("feed-1:https://example.com/post");
    expect(toClientArticleState(rows[0]!)).toMatchObject({
      read: true,
      bookmarked: false,
    });
  });

  it("inserts a new article state when none exists", async () => {
    warmTableMocks();
    mockQueryResults(
      [],
      [
        {
          id: "66666666-6666-4666-8666-666666666666",
          user_id: "user-1",
          article_key: "feed-1:https://example.com/post",
          article_id: null,
          read_at: "2026-01-03T00:00:00.000Z",
          saved_at: null,
          starred_at: null,
          archived_at: null,
          annotation_ids: [],
          read_duration_ms: null,
          scroll_depth: null,
          opened_from: null,
          updated_at: "2026-01-03T00:00:00.000Z",
        },
      ],
    );

    const saved = await upsertArticleState({
      user_id: "user-1",
      article_key: "feed-1:https://example.com/post",
      read: true,
    });

    expect(saved.article_key).toBe("feed-1:https://example.com/post");
    expect(saved.read_at).not.toBeNull();
  });
});
