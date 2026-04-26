import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadArticleCorpusMock } = vi.hoisted(() => ({
  loadArticleCorpusMock: vi.fn(),
}));

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

vi.mock("@/lib/article-corpus", () => ({
  loadArticleCorpus: loadArticleCorpusMock,
}));

describe("sitemap", () => {
  beforeEach(() => {
    vi.resetModules();
    loadArticleCorpusMock.mockReset();
    loadArticleCorpusMock.mockResolvedValue({
      metadata: {
        generated_at: null,
        source_db: "data/ai-web-feeds.db",
        article_count: 0,
        feed_count: 0,
        latest_published_at: null,
        is_empty: true,
      },
      articles: [],
    });
  });

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

  it("keeps article attribution routes out of the canonical sitemap", async () => {
    loadArticleCorpusMock.mockResolvedValue({
      metadata: {
        generated_at: "2026-04-26T00:00:00.000Z",
        source_db: "data/ai-web-feeds.db",
        article_count: 1,
        feed_count: 1,
        latest_published_at: "2026-04-25T00:00:00.000Z",
        is_empty: false,
      },
      articles: [
        {
          id: "article-1",
          feed_id: "feed-1",
          feed_title: "Agent Feed",
          title: "Agent planning roundup",
          link: "https://example.com/agent-planning-roundup",
          summary: "A roundup.",
          content_html: null,
          author: null,
          published_at: "2026-04-25T00:00:00.000Z",
          categories: [],
          topics: ["agents"],
          source_type: "blog",
          verified: true,
          is_active: true,
        },
      ],
    });

    const { default: sitemap } = await import("./sitemap");
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.some((url) => url.includes("/articles/"))).toBe(false);
    expect(urls).toContain("https://aiwebfeeds.w4w.dev/reader");
  });
});
