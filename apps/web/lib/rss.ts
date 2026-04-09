import { Feed } from "feed";
import { getSiteBaseUrl } from "@/lib/env";
import { source } from "@/lib/source";

const baseUrl = getSiteBaseUrl();
const currentYear = new Date().getFullYear();
const fallbackFeedDate = new Date("2025-01-01T00:00:00.000Z");

function resolvePageDate(page: ReturnType<typeof source.getPages>[number]) {
  const pageData = page.data as unknown as Record<string, unknown>;
  const candidates = [pageData.lastModified, pageData.date];

  for (const value of candidates) {
    if (typeof value !== "string" || value.length === 0) {
      continue;
    }

    const parsedDate = new Date(value);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return fallbackFeedDate;
}

function resolvePageCategory(pageUrl: string) {
  if (pageUrl.includes("/features/")) {
    return [{ name: "Features" }];
  }

  if (pageUrl.includes("/guides/")) {
    return [{ name: "Guides" }];
  }

  if (pageUrl.includes("/development/")) {
    return [{ name: "Development" }];
  }

  return [{ name: "Documentation" }];
}

/**
 * Generate RSS feed for documentation
 */
export function getDocsRSS() {
  const feed = new Feed({
    title: "AI Web Feeds - Documentation",
    id: `${baseUrl}/docs`,
    link: `${baseUrl}/docs`,
    language: "en",
    description:
      "Documentation updates for AI Web Feeds - Curated RSS/Atom feeds optimized for AI agents",

    image: `${baseUrl}/banner.png`,
    favicon: `${baseUrl}/favicon.ico`,
    copyright: `All rights reserved ${currentYear}, AI Web Feeds`,

    feedLinks: {
      rss2: `${baseUrl}/docs/rss.xml`,
      json: `${baseUrl}/docs/feed.json`,
      atom: `${baseUrl}/docs/atom.xml`,
    },

    author: {
      name: "AI Web Feeds Team",
      link: baseUrl,
    },
  });

  // Add all documentation pages to the feed
  const pages = source.getPages();

  for (const page of pages) {
    const publishedDate = resolvePageDate(page);

    feed.addItem({
      id: `${baseUrl}${page.url}`,
      title: page.data.title,
      description: page.data.description || `Documentation for ${page.data.title}`,
      link: `${baseUrl}${page.url}`,
      date: publishedDate,

      category: resolvePageCategory(page.url),

      author: [
        {
          name: "AI Web Feeds Team",
          link: baseUrl,
        },
      ],
    });
  }

  return feed;
}

/**
 * Generate sitewide RSS feed (all content)
 */
export function getSitewideRSS() {
  const feed = new Feed({
    title: "AI Web Feeds",
    id: baseUrl,
    link: baseUrl,
    language: "en",
    description: "Curated RSS/Atom feeds optimized for AI agents and large language models",

    image: `${baseUrl}/banner.png`,
    favicon: `${baseUrl}/favicon.ico`,
    copyright: `All rights reserved ${currentYear}, AI Web Feeds`,

    feedLinks: {
      rss2: `${baseUrl}/rss.xml`,
      json: `${baseUrl}/feed.json`,
      atom: `${baseUrl}/atom.xml`,
    },

    author: {
      name: "AI Web Feeds Team",
      link: baseUrl,
    },
  });

  // Add all pages
  const pages = source.getPages();

  for (const page of pages) {
    const publishedDate = resolvePageDate(page);

    feed.addItem({
      id: `${baseUrl}${page.url}`,
      title: page.data.title,
      description: page.data.description || `${page.data.title}`,
      link: `${baseUrl}${page.url}`,
      date: publishedDate,

      category: resolvePageCategory(page.url),

      author: [
        {
          name: "AI Web Feeds Team",
          link: baseUrl,
        },
      ],
    });
  }

  return feed;
}

/**
 * Generate blog RSS feed
 * Note: Set up blog content source when ready
 */
export function getBlogRSS() {
  const feed = new Feed({
    title: "AI Web Feeds - Blog",
    id: `${baseUrl}/blog`,
    link: `${baseUrl}/blog`,
    language: "en",
    description: "Latest updates and articles from AI Web Feeds",

    image: `${baseUrl}/banner.png`,
    favicon: `${baseUrl}/favicon.ico`,
    copyright: `All rights reserved ${currentYear}, AI Web Feeds`,

    feedLinks: {
      rss2: `${baseUrl}/blog/rss.xml`,
      json: `${baseUrl}/blog/feed.json`,
      atom: `${baseUrl}/blog/atom.xml`,
    },

    author: {
      name: "AI Web Feeds Team",
      link: baseUrl,
    },
  });

  // TODO: Add blog posts when blog source is set up
  // For now, return empty feed structure

  return feed;
}

/**
 * Helper to get RSS in different formats
 */
export const getRSSFormats = (feed: Feed) => ({
  rss2: feed.rss2(),
  atom1: feed.atom1(),
  json1: feed.json1(),
});
