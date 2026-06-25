import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertDbConfigured } from "@/lib/server/db";

import {
  deleteReaderFilter,
  ensureSavedReaderFiltersTable,
  listReaderFilters,
  resetSavedReaderFiltersTableCacheForTests,
  saveReaderFilter,
} from "./reader-filters";

vi.mock("@/lib/server/db", () => ({
  assertDbConfigured: vi.fn(),
}));

const samplePayload = {
  query: "agent",
  feedIds: ["feed-1"],
  sourceType: "blog",
  topics: ["agents"],
  verified: true,
  sort: "latest" as const,
  readerView: "unread" as const,
};

describe("reader-filters store", () => {
  const sql = Object.assign(vi.fn(), {
    transaction: vi.fn().mockResolvedValue([]),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetSavedReaderFiltersTableCacheForTests();
    vi.mocked(assertDbConfigured).mockReturnValue(sql as never);
    sql.mockResolvedValue([]);
    sql.transaction.mockResolvedValue([]);
  });

  function mockDdlThen(rows: Record<string, unknown>[]): void {
    sql.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce(rows);
  }

  it("ensures table DDL runs once", async () => {
    await ensureSavedReaderFiltersTable(sql as never);
    await ensureSavedReaderFiltersTable(sql as never);

    expect(sql.transaction).toHaveBeenCalledTimes(1);
    const ddlBatch = sql.transaction.mock.calls[0]?.[0] as unknown[];
    expect(ddlBatch).toHaveLength(2);
  });

  it("lists reader filters for a user", async () => {
    mockDdlThen([
      {
        id: "33333333-3333-4333-8333-333333333333",
        user_id: "user-1",
        filter_name: "Unread agents",
        payload: samplePayload,
        schema_version: "reader-filter-v1",
        use_count: 2,
        pinned: true,
        is_default: false,
        created_at: "2026-01-01T00:00:00.000Z",
        last_used_at: "2026-01-02T00:00:00.000Z",
      },
    ]);

    const rows = await listReaderFilters("user-1");

    expect(sql.transaction).toHaveBeenCalledTimes(1);
    expect(rows[0]?.filter_name).toBe("Unread agents");
    expect(rows[0]?.payload.query).toBe("agent");
  });

  it("saves a reader filter", async () => {
    mockDdlThen([
      {
        id: "44444444-4444-4444-8444-444444444444",
        user_id: "user-1",
        filter_name: "Unread agents",
        payload: samplePayload,
        schema_version: "reader-filter-v1",
        use_count: 0,
        pinned: false,
        is_default: true,
        created_at: "2026-01-03T00:00:00.000Z",
        last_used_at: "2026-01-03T00:00:00.000Z",
      },
    ]);

    const saved = await saveReaderFilter({
      user_id: "user-1",
      filter_name: "Unread agents",
      payload: samplePayload,
      is_default: true,
    });

    expect(saved.is_default).toBe(true);
    expect(saved.schema_version).toBe("reader-filter-v1");
  });

  it("deletes a reader filter scoped to user", async () => {
    mockDdlThen([{ id: "44444444-4444-4444-8444-444444444444" }]);

    const deleted = await deleteReaderFilter("user-1", "44444444-4444-4444-8444-444444444444");

    expect(deleted).toBe(true);
  });
});
