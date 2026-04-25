import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

async function loadHomePage() {
  const pageModule = await import("./page");
  return pageModule.default;
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.resetModules();
    redirectMock.mockClear();
  });

  it("redirects the homepage to the canonical feeds workspace", async () => {
    const HomePage = await loadHomePage();

    await expect(
      HomePage({
        searchParams: Promise.resolve({ q: "agents", feed: ["feed-1", "feed-2"] }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/feeds?q=agents&feed=feed-1&feed=feed-2");

    expect(redirectMock).toHaveBeenCalledWith("/feeds?q=agents&feed=feed-1&feed=feed-2");
  });
});
