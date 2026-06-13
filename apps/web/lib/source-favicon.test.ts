import { describe, expect, it } from "vitest";
import { deriveSourceFaviconUrl, getSourceInitials } from "./source-favicon";

describe("source favicon helpers", () => {
  it("prefers explicit favicon-like fields", () => {
    expect(
      deriveSourceFaviconUrl({
        favicon_url: "https://example.com/icon.png",
        icon_url: "https://example.com/other.png",
        url: "https://example.com/feed.xml",
      }),
    ).toBe("https://example.com/icon.png");
  });

  it("does not synthesize remote host favicons from feed URLs", () => {
    expect(
      deriveSourceFaviconUrl({
        website_url: "https://example.com/articles",
        url: "https://feeds.example.net/rss.xml",
      }),
    ).toBeNull();

    expect(deriveSourceFaviconUrl({ url: "https://feeds.example.net/rss.xml" })).toBeNull();
  });

  it("ignores non-secure favicon URLs", () => {
    expect(deriveSourceFaviconUrl({ favicon_url: "http://example.com/icon.png" })).toBeNull();
    expect(deriveSourceFaviconUrl({ url: "http://feeds.example.net/rss.xml" })).toBeNull();
  });

  it("falls back to readable source initials", () => {
    expect(getSourceInitials("PyTorch Releases")).toBe("PR");
    expect(getSourceInitials("")).toBe("AI");
  });
});
