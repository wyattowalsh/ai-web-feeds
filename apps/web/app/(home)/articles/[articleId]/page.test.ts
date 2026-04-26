import { beforeEach, describe, expect, it, vi } from "vitest";

const { getArticleBySlugMock } = vi.hoisted(() => ({
  getArticleBySlugMock: vi.fn(),
}));

vi.mock("@/lib/public-content", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/public-content")>("@/lib/public-content");
  return {
    ...actual,
    getArticleBySlug: getArticleBySlugMock,
    getArticlePath: () => "/articles/agent-planning-roundup-abc123",
  };
});

vi.mock("@/lib/article-corpus", () => ({
  loadArticleCorpus: vi.fn(),
}));

vi.mock("@/lib/feeds", () => ({
  loadFeedCatalog: () => ({ sources: [] }),
}));

vi.mock("server-only", () => ({}));

describe("article attribution page metadata", () => {
  beforeEach(() => {
    vi.resetModules();
    getArticleBySlugMock.mockReset();
  });

  it("uses a self canonical URL and noindex follow robots", async () => {
    getArticleBySlugMock.mockResolvedValue({
      id: "article-1",
      feed_id: "feed-1",
      feed_title: "Agent Feed",
      title: "Agent planning roundup",
      link: "https://example.com/agent-planning-roundup",
      summary: "A roundup of agent planning posts.",
      content_html: null,
      author: null,
      published_at: "2026-04-25T00:00:00.000Z",
      categories: [],
      topics: ["agents"],
      source_type: "blog",
      verified: true,
      is_active: true,
    });

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({
      params: Promise.resolve({ articleId: "agent-planning-roundup-abc123" }),
    });

    expect(metadata.alternates?.canonical).toBe(
      "https://aiwebfeeds.w4w.dev/articles/agent-planning-roundup-abc123",
    );
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    });
  });
});
