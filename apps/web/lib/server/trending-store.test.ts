import { beforeEach, describe, expect, it, vi } from "vitest";

const sqlMock = vi.fn().mockResolvedValue([]);

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/db", () => ({
  getSql: vi.fn(() => sqlMock),
}));

import { getSql } from "@/lib/server/db";
import { listTrendingTopics } from "@/lib/server/trending-store";

describe("trending-store", () => {
  beforeEach(() => {
    sqlMock.mockReset();
    vi.mocked(getSql).mockReturnValue(sqlMock as never);
  });

  it("returns an empty array when DATABASE_URL is not configured", async () => {
    vi.mocked(getSql).mockReturnValue(null);

    await expect(listTrendingTopics(10)).resolves.toEqual([]);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns an empty array when topic_stats has no snapshots", async () => {
    sqlMock.mockResolvedValueOnce([]);

    await expect(listTrendingTopics(5)).resolves.toEqual([]);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("queries the latest snapshot ordered by validation_frequency", async () => {
    sqlMock.mockResolvedValueOnce([{ snapshot_date: "2026-06-24" }]).mockResolvedValueOnce([
      {
        topic: "agents",
        feed_count: 10,
        validation_frequency: 0.9,
        avg_health_score: 0.88,
      },
    ]);

    await expect(listTrendingTopics(3)).resolves.toEqual([
      {
        topic: "agents",
        feed_count: 10,
        validation_count: 9,
        validation_frequency: 0.9,
        avg_health_score: 0.88,
      },
    ]);

    expect(sqlMock).toHaveBeenCalledTimes(2);
    const latestSnapshotQuery = sqlMock.mock.calls[0]?.[0]?.join(" ") ?? "";
    const topicStatsQuery = sqlMock.mock.calls[1]?.[0]?.join(" ") ?? "";
    expect(latestSnapshotQuery).toContain("FROM topic_stats");
    expect(latestSnapshotQuery).toContain("ORDER BY snapshot_date DESC");
    expect(topicStatsQuery).toContain("ORDER BY validation_frequency DESC");
    expect(topicStatsQuery).toContain("WHERE snapshot_date");
  });
});
