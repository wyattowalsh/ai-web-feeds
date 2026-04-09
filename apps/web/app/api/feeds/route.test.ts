import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

const loadFeedCatalogMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/feeds", () => ({
  loadFeedCatalog: loadFeedCatalogMock,
}));

import { GET } from "./route";

describe("GET /api/feeds", () => {
  beforeEach(() => {
    loadFeedCatalogMock.mockReset();
  });

  it("uses shared loadFeedCatalog source of truth", async () => {
    loadFeedCatalogMock.mockReturnValue({
      sourceFile: "feeds.enriched.yaml",
      sources: [{ id: "enriched", title: "Enriched", url: "https://example.com/enriched.xml" }],
    });

    const response = await GET(new Request("http://localhost/api/feeds"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(loadFeedCatalogMock).toHaveBeenCalledTimes(1);
    expect(payload).toEqual([
      { id: "enriched", title: "Enriched", url: "https://example.com/enriched.xml" },
    ]);
  });
});
