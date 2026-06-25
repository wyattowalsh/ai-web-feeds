import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertDbConfigured } from "@/lib/server/db";

import { getNotificationPreferences, upsertNotificationPreference } from "./preferences";

vi.mock("@/lib/server/db", () => ({
  assertDbConfigured: vi.fn(),
}));

describe("preferences store", () => {
  const sql = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertDbConfigured).mockReturnValue(sql as never);
  });

  it("gets notification preferences for a user", async () => {
    sql.mockResolvedValueOnce([
      {
        id: 1,
        user_id: "user-1",
        feed_id: null,
        delivery_method: "EMAIL",
        frequency: "DAILY",
        quiet_hours_start: "22:00",
        quiet_hours_end: "07:00",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const prefs = await getNotificationPreferences("user-1");

    expect(prefs[0]).toMatchObject({
      delivery_method: "email",
      frequency: "daily",
      quiet_hours_start: "22:00",
    });
  });

  it("updates an existing preference", async () => {
    sql.mockResolvedValueOnce([{ id: 1 }]);
    sql.mockResolvedValueOnce([
      {
        id: 1,
        user_id: "user-1",
        feed_id: null,
        delivery_method: "IN_APP",
        frequency: "INSTANT",
        quiet_hours_start: null,
        quiet_hours_end: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
      },
    ]);

    const saved = await upsertNotificationPreference({
      user_id: "user-1",
      delivery_method: "in_app",
      frequency: "instant",
    });

    expect(saved.frequency).toBe("instant");
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("inserts a new preference when none exists", async () => {
    sql.mockResolvedValueOnce([]);
    sql.mockResolvedValueOnce([
      {
        id: 2,
        user_id: "user-1",
        feed_id: "openai-blog",
        delivery_method: "WEBSOCKET",
        frequency: "HOURLY",
        quiet_hours_start: null,
        quiet_hours_end: null,
        created_at: "2026-01-03T00:00:00.000Z",
        updated_at: "2026-01-03T00:00:00.000Z",
      },
    ]);

    const saved = await upsertNotificationPreference({
      user_id: "user-1",
      feed_id: "openai-blog",
      delivery_method: "websocket",
      frequency: "hourly",
    });

    expect(saved.feed_id).toBe("openai-blog");
    expect(saved.delivery_method).toBe("websocket");
  });
});
