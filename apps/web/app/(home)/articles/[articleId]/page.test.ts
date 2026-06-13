import { beforeEach, describe, expect, it, vi } from "vitest";

const { getArticleBySlugMock, notFoundMock } = vi.hoisted(() => ({
  getArticleBySlugMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
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

vi.mock("@/lib/nonce", () => ({
  getRequestNonce: vi.fn(async () => "test-nonce"),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("server-only", () => ({}));

describe("article attribution page metadata", () => {
  beforeEach(() => {
    vi.resetModules();
    getArticleBySlugMock.mockReset();
    notFoundMock.mockClear();
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
      topics: ["agents"],
      raw_categories: [],
      source_topics: ["agents"],
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

  it("returns stable noindex metadata for missing article slugs", async () => {
    getArticleBySlugMock.mockResolvedValue(null);

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({
      params: Promise.resolve({ articleId: "example" }),
    });

    expect(metadata.title).toBe("Article not found");
    expect(metadata.description).toBe(
      "This article reference is not available in the public AI Web Feeds corpus.",
    );
    expect(metadata.alternates?.canonical).toBe("https://aiwebfeeds.w4w.dev/articles/example");
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: true,
    });
  });

  it("uses the page-level 404 path for missing article slugs", async () => {
    getArticleBySlugMock.mockResolvedValue(null);

    const { default: ArticlePage } = await import("./page");

    await expect(
      ArticlePage({ params: Promise.resolve({ articleId: "example" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
