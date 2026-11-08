import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { existsSyncMock, databaseSyncMock, loadFeedCatalogMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
  databaseSyncMock: vi.fn(),
  loadFeedCatalogMock: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: existsSyncMock,
  };
});

vi.mock("node:sqlite", () => ({
  DatabaseSync: databaseSyncMock,
  default: { DatabaseSync: databaseSyncMock },
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/feeds", () => ({
  loadFeedCatalog: loadFeedCatalogMock,
}));

type SnapshotRow = {
  date: string;
  count: number;
};

const state: {
  databaseExists: boolean;
  rows: SnapshotRow[];
  sql: string[];
} = {
  databaseExists: false,
  rows: [],
  sql: [],
};

function openDatabase() {
  return {
    prepare(sql: string) {
      state.sql.push(sql);
      return {
        all: () => state.rows,
      };
    },
    close() {},
  };
}

async function loadRouteModule() {
  return import("./route");
}

function createRequest(query = ""): Request {
  return new Request(`http://localhost/api/analytics/velocity${query}`);
}

describe("GET /api/analytics/velocity", () => {
  beforeEach(() => {
    vi.resetModules();
    existsSyncMock.mockReset();
    databaseSyncMock.mockReset();
    loadFeedCatalogMock.mockReset();
    state.databaseExists = false;
    state.rows = [];
    state.sql = [];

    existsSyncMock.mockImplementation(
      (candidate: unknown) => state.databaseExists && String(candidate).endsWith("ai-web-feeds.db"),
    );
    databaseSyncMock.mockImplementation(openDatabase);
    loadFeedCatalogMock.mockReturnValue({ sources: [] });
  });

  it.each(["missing database", "empty validation snapshot", "unreadable catalog"])(
    "returns an empty non-demo body for %s",
    async (storage) => {
      const { GET } = await loadRouteModule();

      if (storage === "empty validation snapshot") {
        state.databaseExists = true;
      }

      if (storage === "unreadable catalog") {
        loadFeedCatalogMock.mockImplementation(() => {
          throw new Error("Failed to load feeds data");
        });
      }

      const response = await GET(createRequest());

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        demo: false,
        points: [],
      });
    },
  );

  it("counts validation snapshot rows and ignores undated catalog rows", async () => {
    const { GET } = await loadRouteModule();
    state.databaseExists = true;
    state.rows = [
      { date: "2026-06-29", count: 4 },
      { date: "2026-06-30", count: 1 },
    ];
    loadFeedCatalogMock.mockReturnValue({
      sources: [
        {
          id: "extra",
          title: "Extra",
          url: "https://example.com/feed.xml",
          last_validated: "2026-06-29T00:00:00Z",
        },
      ],
    });

    const response = await GET(createRequest());
    const body = await response.json();

    expect(body).toEqual({
      demo: false,
      points: [
        { date: "2026-06-29", count: 4 },
        { date: "2026-06-30", count: 1 },
      ],
    });
    expect(loadFeedCatalogMock).not.toHaveBeenCalled();
    expect(state.sql.some((sql) => sql.includes("forecasts"))).toBe(false);
    expect(state.sql.some((sql) => sql.includes("FROM validations"))).toBe(true);
  });

  it("counts dated catalog rows when the validation snapshot is empty", async () => {
    const { GET } = await loadRouteModule();
    loadFeedCatalogMock.mockReturnValue({
      sources: [
        {
          id: "dated",
          title: "Dated",
          url: "https://example.com/dated.xml",
          meta: { last_validated: "2026-06-29 06:51:54" },
        },
        {
          id: "same-day",
          title: "Same day",
          url: "https://example.com/same-day.xml",
          validated_at: "2026-06-29T08:00:00Z",
        },
        {
          id: "undated",
          title: "Undated",
          url: "https://example.com/undated.xml",
          meta: { enriched_at: "2026-06-29T08:00:00Z", validation_count: 99 },
        },
      ],
    });

    const response = await GET(createRequest());

    await expect(response.json()).resolves.toEqual({
      demo: false,
      points: [{ date: "2026-06-29", count: 2 }],
    });
  });

  it("drops days outside the requested range without filling gaps", async () => {
    const { GET } = await loadRouteModule();
    const today = new Date().toISOString().slice(0, 10);
    state.databaseExists = true;
    state.rows = [
      { date: "2020-01-01", count: 8 },
      { date: today, count: 3 },
    ];

    const response = await GET(createRequest("?date_range=7d&granularity=daily"));

    await expect(response.json()).resolves.toEqual({
      demo: false,
      points: [{ date: today, count: 3 }],
    });
  });

  it("sums real snapshot counts into weekly and monthly buckets", async () => {
    const { GET } = await loadRouteModule();
    state.databaseExists = true;
    state.rows = [
      { date: "2026-06-21", count: 2 },
      { date: "2026-06-29", count: 4 },
      { date: "2026-06-30", count: 1 },
    ];

    const weekly = await GET(createRequest("?granularity=weekly"));
    await expect(weekly.json()).resolves.toEqual({
      demo: false,
      points: [
        { date: "2026-W25", count: 2 },
        { date: "2026-W27", count: 5 },
      ],
    });

    const monthly = await GET(createRequest("?granularity=monthly"));
    await expect(monthly.json()).resolves.toEqual({
      demo: false,
      points: [{ date: "2026-06", count: 7 }],
    });
  });

  it("keeps demo false in the source and does not synthesize a series", () => {
    const source = readFileSync(join(process.cwd(), "app/api/analytics/velocity/route.ts"), "utf8");

    expect(source).toContain("demo: false");
    expect(source).toContain("points: []");
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("sample");
  });
});
