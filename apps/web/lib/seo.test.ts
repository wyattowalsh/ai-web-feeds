import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  createPageMetadata,
  noIndexFollowRobots,
  normalizeSiteUrl,
  SITE_URL,
} from "./seo";

describe("seo helpers", () => {
  it("uses the configured canonical production host", () => {
    expect(SITE_URL).toBe("https://aiwebfeeds.w4w.dev");
    expect(absoluteUrl("/reader")).toBe("https://aiwebfeeds.w4w.dev/reader");
    expect(absoluteUrl("sources")).toBe("https://aiwebfeeds.w4w.dev/sources");
  });

  it("leaves absolute URLs unchanged", () => {
    expect(absoluteUrl("https://example.com/post")).toBe("https://example.com/post");
  });

  it("normalizes trailing slashes from site URLs", () => {
    expect(normalizeSiteUrl("https://example.com///")).toBe("https://example.com");
  });

  it("builds complete route metadata with canonical and social URLs", () => {
    const metadata = createPageMetadata({
      title: "Sources - AI Web Feeds",
      description: "Browse source metadata.",
      path: "/sources",
    });

    expect(metadata.alternates?.canonical).toBe("https://aiwebfeeds.w4w.dev/sources");
    expect(metadata.openGraph).toMatchObject({
      url: "https://aiwebfeeds.w4w.dev/sources",
      title: "Sources - AI Web Feeds",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Sources - AI Web Feeds",
    });
  });

  it("supports noindex follow metadata for attribution pages", () => {
    const metadata = createPageMetadata({
      title: "Article reference",
      description: "Article attribution page.",
      path: "/articles/example",
      type: "article",
      robots: noIndexFollowRobots,
    });

    expect(metadata.alternates?.canonical).toBe("https://aiwebfeeds.w4w.dev/articles/example");
    expect(metadata.robots).toEqual(noIndexFollowRobots);
  });
});
