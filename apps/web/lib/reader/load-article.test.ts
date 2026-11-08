import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { getArticleBySlugMock, loadArticleCorpusMock } = vi.hoisted(() => ({
  getArticleBySlugMock: vi.fn(),
  loadArticleCorpusMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/public-content", () => ({
  getArticleBySlug: getArticleBySlugMock,
}));

vi.mock("@/lib/article-corpus", () => ({
  loadArticleCorpus: loadArticleCorpusMock,
}));

import { loadArticleForReader } from "./load-article";

const source = readFileSync(join(process.cwd(), "lib/reader/load-article.ts"), "utf8");

describe("loadArticleForReader", () => {
  beforeEach(() => {
    getArticleBySlugMock.mockReset();
    loadArticleCorpusMock.mockReset();
  });

  it("returns null for a blank or non-string id", async () => {
    getArticleBySlugMock.mockRejectedValue(new Error("should not load"));
    loadArticleCorpusMock.mockRejectedValue(new Error("should not load"));

    await expect(loadArticleForReader("")).resolves.toBeNull();
    await expect(loadArticleForReader(undefined as never)).resolves.toBeNull();
    await expect(loadArticleForReader(null as never)).resolves.toBeNull();
    await expect(loadArticleForReader(0 as never)).resolves.toBeNull();
    await expect(loadArticleForReader(false as never)).resolves.toBeNull();
    await expect(loadArticleForReader(1 as never)).resolves.toBeNull();
    await expect(loadArticleForReader({ id: "post-1" } as never)).resolves.toBeNull();

    expect(getArticleBySlugMock).not.toHaveBeenCalled();
    expect(loadArticleCorpusMock).not.toHaveBeenCalled();
  });

  it("returns the getArticleBySlug article without searching the corpus", async () => {
    const article = { id: "raw-id", feed_id: "feed-1" };
    getArticleBySlugMock.mockResolvedValue(article);

    await expect(loadArticleForReader("public-slug")).resolves.toBe(article);
    expect(getArticleBySlugMock).toHaveBeenCalledTimes(1);
    expect(getArticleBySlugMock).toHaveBeenCalledWith("public-slug");
    expect(loadArticleCorpusMock).not.toHaveBeenCalled();
  });

  it("returns the corpus article whose id matches when the slug misses", async () => {
    const match = { id: "post-1", feed_id: "feed-1" };
    getArticleBySlugMock.mockResolvedValue(null);
    loadArticleCorpusMock.mockResolvedValue({
      articles: [{ id: "other", feed_id: "post-1" }, match],
    });

    await expect(loadArticleForReader("post-1")).resolves.toBe(match);
    expect(getArticleBySlugMock).toHaveBeenCalledWith("post-1");
    expect(loadArticleCorpusMock).toHaveBeenCalledTimes(1);
  });

  it("returns the corpus article whose feed_id:id matches when the slug misses", async () => {
    const match = { id: "post-1", feed_id: "feed-1" };
    getArticleBySlugMock.mockResolvedValue(null);
    loadArticleCorpusMock.mockResolvedValue({
      articles: [{ id: "post-1", feed_id: "other" }, match],
    });

    await expect(loadArticleForReader("feed-1:post-1")).resolves.toBe(match);
    expect(getArticleBySlugMock).toHaveBeenCalledWith("feed-1:post-1");
    expect(loadArticleCorpusMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when the slug misses and no corpus article matches", async () => {
    getArticleBySlugMock.mockResolvedValue(null);
    loadArticleCorpusMock.mockResolvedValue({
      articles: [{ id: "post-1", feed_id: "feed-1" }],
    });

    await expect(loadArticleForReader("missing")).resolves.toBeNull();
    await expect(loadArticleForReader("feed-2:post-1")).resolves.toBeNull();
    await expect(loadArticleForReader("feed-1:post-2")).resolves.toBeNull();
    expect(loadArticleCorpusMock).toHaveBeenCalledTimes(3);
  });

  it("returns null when getArticleBySlug throws", async () => {
    getArticleBySlugMock.mockRejectedValue(new Error("slug down"));
    await expect(loadArticleForReader("post-1")).resolves.toBeNull();

    getArticleBySlugMock.mockImplementation(() => {
      throw new Error("slug sync");
    });
    await expect(loadArticleForReader("post-1")).resolves.toBeNull();

    expect(loadArticleCorpusMock).not.toHaveBeenCalled();
  });

  it("returns null when the corpus lookup throws", async () => {
    getArticleBySlugMock.mockResolvedValue(null);
    loadArticleCorpusMock.mockRejectedValue(new Error("corpus down"));
    await expect(loadArticleForReader("post-1")).resolves.toBeNull();

    loadArticleCorpusMock.mockImplementation(() => {
      throw new Error("corpus sync");
    });
    await expect(loadArticleForReader("post-1")).resolves.toBeNull();

    loadArticleCorpusMock.mockResolvedValue(null);
    await expect(loadArticleForReader("post-1")).resolves.toBeNull();
  });

  it("keeps slug lookup ahead of the corpus id and feed composite key", () => {
    expect(source).toContain('import "server-only"');
    expect(source).toContain("export async function loadArticleForReader");
    expect(source).toContain("getArticleBySlug(articleId)");
    expect(source).toContain("loadArticleCorpus()");
    expect(source).toContain(
      "article.id === articleId || `${article.feed_id}:${article.id}` === articleId",
    );
  });
});
