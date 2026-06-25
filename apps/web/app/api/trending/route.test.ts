import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { listTrendingMock } = vi.hoisted(() => ({
  listTrendingMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/server/trending-store", () => ({
  trendingStore: {
    list: listTrendingMock,
  },
}));

function createRequest(url: string): NextRequest {
  return new NextRequest(url);
}

import { GET } from "./route";

describe("/api/trending route", () => {
  beforeEach(() => {
    listTrendingMock.mockReset();
  });

  it("returns trending topics with a clamped limit", async () => {
    listTrendingMock.mockResolvedValue([
      {
        topic: "agents",
        feed_count: 12,
        validation_count: 10,
        validation_frequency: 0.83,
        avg_health_score: 0.91,
      },
    ]);

    const response = await GET(createRequest("http://localhost/api/trending?limit=500"));

    expect(response.status).toBe(200);
    expect(listTrendingMock).toHaveBeenCalledWith(100);
    await expect(response.json()).resolves.toMatchObject({
      trending: [
        {
          topic: "agents",
          feed_count: 12,
          validation_count: 10,
          validation_frequency: 0.83,
          avg_health_score: 0.91,
        },
      ],
      count: 1,
      updated_at: expect.any(String),
    });
  });

  it("returns an empty trending list when the store has no rows", async () => {
    listTrendingMock.mockResolvedValue([]);

    const response = await GET(createRequest("http://localhost/api/trending"));

    expect(response.status).toBe(200);
    expect(listTrendingMock).toHaveBeenCalledWith(10);
    await expect(response.json()).resolves.toEqual({
      trending: [],
      count: 0,
      updated_at: expect.any(String),
    });
  });

  it("defaults limit to 10 when the query param is omitted", async () => {
    listTrendingMock.mockResolvedValue([]);

    await GET(createRequest("http://localhost/api/trending"));

    expect(listTrendingMock).toHaveBeenCalledWith(10);
  });
});
