import { beforeEach, describe, expect, it, vi } from "vitest";

const { createFromSourceMock, docsSearchGetMock } = vi.hoisted(() => ({
  createFromSourceMock: vi.fn(),
  docsSearchGetMock: vi.fn(),
}));

vi.mock("fumadocs-core/search/server", () => ({
  createFromSource: createFromSourceMock,
}));

vi.mock("@/lib/source", () => ({
  source: { pageTree: { name: "docs" } },
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

describe("/api/docs/search route", () => {
  beforeEach(() => {
    vi.resetModules();
    createFromSourceMock.mockReset();
    docsSearchGetMock.mockReset();
    docsSearchGetMock.mockResolvedValue(
      Response.json([
        { type: "page", id: "reader", content: "Reader", url: "/docs/features/reader" },
      ]),
    );
    createFromSourceMock.mockReturnValue({ GET: docsSearchGetMock });
  });

  it("mounts the FumaDocs source search endpoint", async () => {
    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/docs/search?query=reader");

    const response = await GET(request);

    expect(createFromSourceMock).toHaveBeenCalledWith({ pageTree: { name: "docs" } });
    expect(docsSearchGetMock).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        type: "page",
        id: "reader",
        content: "Reader",
        url: "/docs/features/reader",
      },
    ]);
  });
});
