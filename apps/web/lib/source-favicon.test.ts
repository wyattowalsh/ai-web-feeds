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

  it("derives host favicons from website or feed URLs", () => {
    expect(
      deriveSourceFaviconUrl({
        website_url: "https://example.com/articles",
        url: "https://feeds.example.net/rss.xml",
      }),
    ).toBe("https://example.com/favicon.ico");

    expect(deriveSourceFaviconUrl({ url: "https://feeds.example.net/rss.xml" })).toBe(
      "https://feeds.example.net/favicon.ico",
    );
  });

  it("falls back to readable source initials", () => {
    expect(getSourceInitials("PyTorch Releases")).toBe("PR");
    expect(getSourceInitials("")).toBe("AI");
  });
});
