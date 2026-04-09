import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadFeedCatalogMock, resolveDataDirMock, readFileSyncMock } = vi.hoisted(() => ({
  loadFeedCatalogMock: vi.fn(),
  resolveDataDirMock: vi.fn(),
  readFileSyncMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/feeds", () => ({
  loadFeedCatalog: loadFeedCatalogMock,
}));

vi.mock("@/lib/runtime-paths", () => ({
  resolveDataDir: resolveDataDirMock,
}));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    default: {
      ...(actual as unknown as { default?: Record<string, unknown> }).default,
      readFileSync: readFileSyncMock,
    },
    readFileSync: readFileSyncMock,
  };
});

import { GET } from "./route";

describe("GET /api/exports/opml", () => {
  beforeEach(() => {
    loadFeedCatalogMock.mockReset();
    resolveDataDirMock.mockReset();
    readFileSyncMock.mockReset();
  });

  it("returns a filtered OPML export for explicit feed ids", async () => {
    loadFeedCatalogMock.mockReturnValue({
      sourceFile: "feeds.enriched.yaml",
      sources: [
        {
          id: "feed-1",
          title: "Agent Systems Daily",
          url: "https://example.com/agents",
          feed: "https://example.com/agents.xml",
          description: "Fresh agent research",
        },
        {
          id: "feed-2",
          title: "Ignored Feed",
          url: "https://example.com/ignored",
          feed: "https://example.com/ignored.xml",
        },
      ],
    });

    const response = await GET(
      new Request("http://localhost/api/exports/opml?format=filtered&feed=feed-1"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("ai-ml-feeds-filtered.opml");

    const payload = await response.text();
    expect(payload).toContain('text="Agent Systems Daily"');
    expect(payload).toContain('xmlUrl="https://example.com/agents.xml"');
    expect(payload).toContain('description="Fresh agent research"');
    expect(payload).not.toContain("Ignored Feed");
  });

  it("returns 400 when filtered exports omit explicit feed ids", async () => {
    const response = await GET(new Request("http://localhost/api/exports/opml?format=filtered"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'At least one "feed" query parameter is required for filtered OPML exports.',
    });
  });

  it("treats repeated feed ids as a set when rendering filtered exports", async () => {
    loadFeedCatalogMock.mockReturnValue({
      sourceFile: "feeds.enriched.yaml",
      sources: [
        {
          id: "feed-1",
          title: "Agent Systems Daily",
          url: "https://example.com/agents",
          feed: "https://example.com/agents.xml",
        },
        {
          id: "feed-2",
          title: "ML Weekly",
          url: "https://example.com/ml",
          feed: "https://example.com/ml.xml",
        },
      ],
    });

    const response = await GET(
      new Request(
        "http://localhost/api/exports/opml?format=filtered&feed=feed-1&feed=feed-1&feed=feed-2",
      ),
    );

    expect(response.status).toBe(200);

    const payload = await response.text();
    expect(payload.match(/xmlUrl="https:\/\/example\.com\/agents\.xml"/g)).toHaveLength(1);
    expect(payload.match(/xmlUrl="https:\/\/example\.com\/ml\.xml"/g)).toHaveLength(1);
  });

  it("serves the flat export from the generated OPML file", async () => {
    resolveDataDirMock.mockReturnValue("/tmp/aiwf-data");
    readFileSyncMock.mockReturnValue('<opml version="2.0"></opml>');

    const response = await GET(new Request("http://localhost/api/exports/opml?format=all"));

    expect(response.status).toBe(200);
    expect(readFileSyncMock).toHaveBeenCalledWith("/tmp/aiwf-data/all.opml", "utf-8");
    await expect(response.text()).resolves.toBe('<opml version="2.0"></opml>');
  });
});
