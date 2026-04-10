import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadFeedCatalogMock } = vi.hoisted(() => ({
  loadFeedCatalogMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/feeds", async () => {
  const actual = await vi.importActual<typeof import("@/lib/feeds")>("@/lib/feeds");
  return {
    ...actual,
    loadFeedCatalog: loadFeedCatalogMock,
  };
});

import { GET } from "./route";

describe("GET /api/exports/opml", () => {
  beforeEach(() => {
    loadFeedCatalogMock.mockReset();
    loadFeedCatalogMock.mockReturnValue({
      sources: [
        {
          id: "feed-1",
          title: "Agent Feed",
          url: "https://example.com/feed-1.xml",
          website_url: "https://example.com/feed-1",
          source_type: "blog",
          topics: ["agents", "ml"],
          verified: true,
        },
        {
          id: "feed-2",
          title: "Reader Signals",
          url: "https://example.com/feed-2.xml",
          website_url: "https://example.com/feed-2",
          source_type: "newsletter",
          topics: ["agents"],
          verified: false,
        },
        {
          id: "feed-3",
          title: "MLOps Weekly",
          url: "https://example.com/feed-3.xml",
          source_type: "newsletter",
          topics: ["mlops"],
          verified: false,
        },
      ],
    });
  });

  it.each([
    ["all", 'attachment; filename="ai-ml-feeds-all.opml"'],
    ["categorized", 'attachment; filename="ai-ml-feeds-categorized.opml"'],
  ])("wraps file-backed OPML exports in the aiwebfeeds folder (%s)", async (format, filename) => {
    const response = await GET(new Request(`http://localhost/api/exports/opml?format=${format}`));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe(filename);

    const body = await response.text();
    expect(body).toContain('<outline text="aiwebfeeds" title="aiwebfeeds">');
  });

  it("builds a filtered OPML export from explicit feed ids in request order", async () => {
    const response = await GET(
      new Request("http://localhost/api/exports/opml?format=filtered&feed=feed-2&feed=feed-1"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="ai-ml-feeds-filtered.opml"',
    );

    const body = await response.text();
    expect(body).toContain('<outline text="aiwebfeeds" title="aiwebfeeds">');
    expect(body).toContain('title="Reader Signals"');
    expect(body).toContain('title="Agent Feed"');
    expect(body).not.toContain('title="MLOps Weekly"');
    expect(body.indexOf('title="Reader Signals"')).toBeLessThan(body.indexOf('title="Agent Feed"'));
  });

  it("filters catalog exports by query params when explicit feed ids are absent", async () => {
    const response = await GET(
      new Request("http://localhost/api/exports/opml?format=filtered&type=newsletter&topic=agents"),
    );

    expect(response.status).toBe(200);

    const body = await response.text();
    expect(body).toContain('title="Reader Signals"');
    expect(body).not.toContain('title="Agent Feed"');
    expect(body).not.toContain('title="MLOps Weekly"');
  });
});
