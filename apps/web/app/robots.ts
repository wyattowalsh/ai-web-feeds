import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/", "/admin/", "/static/"],
      },
      ...[
        "GPTBot",
        "ChatGPT-User",
        "OAI-SearchBot",
        "PerplexityBot",
        "ClaudeBot",
        "Claude-SearchBot",
        "Claude-User",
        "anthropic-ai",
        "Google-Extended",
        "Bingbot",
      ].map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: ["/api/", "/_next/", "/admin/"],
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
