import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadFeedCatalogMock, getFeedStatsMock } = vi.hoisted(() => ({
  loadFeedCatalogMock: vi.fn(),
  getFeedStatsMock: vi.fn(),
}));

vi.mock("@/lib/feeds", () => ({
  loadFeedCatalog: loadFeedCatalogMock,
  getFeedStats: getFeedStatsMock,
}));

vi.mock("@/lib/nonce", () => ({
  getRequestNonce: vi.fn(async () => undefined),
}));

async function loadHomePage() {
  const pageModule = await import("./page");
  return pageModule.default;
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.resetModules();
    loadFeedCatalogMock.mockReset();
    getFeedStatsMock.mockReset();
    loadFeedCatalogMock.mockReturnValue({
      sources: [{ id: "feed-1", title: "Agent Feed", url: "https://example.com/feed.xml" }],
    });
    getFeedStatsMock.mockReturnValue({
      total: 1,
      verified: 1,
      active: 1,
      hasVerificationMetadata: true,
      hasActivityMetadata: true,
      sourceTypeCount: 1,
      byType: { blog: 1 },
      topicCount: 1,
    });
  });

  it("renders a minimal home with canonical surface links", async () => {
    const HomePage = await loadHomePage();

    render(await HomePage());

    expect(
      screen.getByRole("heading", { name: "Read AI writing across the open web" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open reader/i })).toHaveAttribute("href", "/reader");
    expect(
      screen
        .getAllByRole("link", { name: /^Search$/i })
        .some((link) => link.getAttribute("href") === "/search"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: /For You/i })
        .some((link) => link.getAttribute("href") === "/for-you"),
    ).toBe(true);
    expect(screen.getByRole("link", { name: /Browse sources/i })).toHaveAttribute(
      "href",
      "/sources",
    );
    expect(screen.getByRole("link", { name: /Topics/i })).toHaveAttribute("href", "/topics");
  });
});
