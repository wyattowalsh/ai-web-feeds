import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots", () => {
  it("uses the canonical sitemap and keeps private surfaces out of search", () => {
    const payload = robots();

    expect(payload.sitemap).toBe("https://aiwebfeeds.w4w.dev/sitemap.xml");
    expect(payload.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userAgent: "*",
          allow: "/",
          disallow: expect.arrayContaining(["/api/", "/_next/", "/admin/"]),
        }),
      ]),
    );
  });

  it("explicitly allows AI citation crawlers", () => {
    const rules = Array.isArray(robots().rules) ? robots().rules : [robots().rules];
    const userAgents = rules.map((rule) => rule.userAgent);

    expect(userAgents).toEqual(
      expect.arrayContaining(["GPTBot", "ChatGPT-User", "OAI-SearchBot", "PerplexityBot"]),
    );
  });
});
