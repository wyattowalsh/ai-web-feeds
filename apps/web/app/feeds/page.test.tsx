import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

async function loadFeedsPage() {
  const pageModule = await import("./page");
  return pageModule.default;
}

describe("FeedsPage", () => {
  beforeEach(() => {
    vi.resetModules();
    redirectMock.mockClear();
  });

  it("redirects the compatibility feeds route to the homepage reader", async () => {
    const FeedsPage = await loadFeedsPage();

    await expect(
      FeedsPage({ searchParams: Promise.resolve({ q: "agents", feed: ["feed-1"] }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/?q=agents&feed=feed-1");

    expect(redirectMock).toHaveBeenCalledWith("/?q=agents&feed=feed-1");
  });
});
