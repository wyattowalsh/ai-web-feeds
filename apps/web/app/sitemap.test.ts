import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/source", () => ({
  source: {
    getPages: () => [
      {
        url: "/docs/features/reader",
        data: {
          title: "Reader",
          description: "Reader docs",
        },
      },
    ],
  },
}));

describe("sitemap", () => {
  it("includes canonical public SEO surfaces", async () => {
    const { default: sitemap } = await import("./sitemap");
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toContain("https://aiwebfeeds.w4w.dev");
    expect(urls).toContain("https://aiwebfeeds.w4w.dev/reader");
    expect(urls).toContain("https://aiwebfeeds.w4w.dev/sources");
    expect(urls).toContain("https://aiwebfeeds.w4w.dev/topics");
    expect(urls).toContain("https://aiwebfeeds.w4w.dev/dashboard");
    expect(urls).toContain("https://aiwebfeeds.w4w.dev/docs");
  });

  it("includes generated source and topic landing pages", async () => {
    const { default: sitemap } = await import("./sitemap");
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.some((url) => url.startsWith("https://aiwebfeeds.w4w.dev/sources/"))).toBe(true);
    expect(urls.some((url) => url.startsWith("https://aiwebfeeds.w4w.dev/topics/"))).toBe(true);
  });
});
