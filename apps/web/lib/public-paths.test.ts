import { describe, expect, it } from "vitest";
import { getSourcePath, getSourceSlug, getTopicPath, slugifyPathSegment } from "./public-paths";

describe("public path helpers", () => {
  it("creates stable URL-safe path segments", () => {
    expect(slugifyPathSegment("Large Language Models")).toBe("large-language-models");
    expect(slugifyPathSegment("  Qwen 3: Releases! ")).toBe("qwen-3-releases");
  });

  it("prefers normalized source ids for source routes", () => {
    const source = {
      id: "openai-blog",
      title: "OpenAI Blog",
      url: "https://openai.com/blog/rss/",
    };

    expect(getSourceSlug(source)).toBe("openai-blog");
    expect(getSourcePath(source)).toBe("/sources/openai-blog");
  });

  it("uses source titles when catalog ids are opaque hashes", () => {
    expect(
      getSourcePath({
        id: "aaaaaaaaaaaaaaaa",
        title: "OpenAI Blog",
        url: "https://openai.com/blog/rss/",
      }),
    ).toBe("/sources/openai-blog-aaaaaaaa");
  });

  it("creates topic collection routes", () => {
    expect(getTopicPath("reasoning-models")).toBe("/topics/reasoning-models");
  });
});
