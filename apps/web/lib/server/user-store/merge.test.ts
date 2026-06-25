import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertDbConfigured } from "@/lib/server/db";

import { mergeAnonymousUserData } from "./merge";

vi.mock("@/lib/server/db", () => ({
  assertDbConfigured: vi.fn(),
}));

vi.mock("./reader-filters", () => ({
  ensureSavedReaderFiltersTable: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./article-state", () => ({
  ensureUserArticleStatesTable: vi.fn().mockResolvedValue(undefined),
}));

describe("merge store", () => {
  const sql = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertDbConfigured).mockReturnValue(sql as never);
    sql.mockResolvedValue([{ id: "1" }, { id: "2" }]);
  });

  it("merges anonymous user data into the target account", async () => {
    const result = await mergeAnonymousUserData({
      from_user_id: "22222222-2222-4222-8222-222222222222",
      to_user_id: "session-user-abc123",
    });

    expect(sql).toHaveBeenCalledTimes(5);
    expect(result.merged.reader_filters).toBe(2);
    expect(result.merged.article_states).toBe(2);
    expect(result.merged.saved_searches).toBe(2);
    expect(result.merged.follows).toBe(2);
    expect(result.merged.notification_preferences).toBe(2);
  });

  it("rejects merging identical user ids", async () => {
    await expect(
      mergeAnonymousUserData({
        from_user_id: "same-user",
        to_user_id: "same-user",
      }),
    ).rejects.toThrow("must differ");
  });
});
