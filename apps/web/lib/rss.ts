import { Feed } from "feed";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { source } from "@/lib/source";

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
    title: `${SITE_NAME} - Documentation`,
    id: `${SITE_URL}/docs`,
    link: `${SITE_URL}/docs`,
    language: "en",
    description:
      "Documentation updates for AI Web Feeds - Curated RSS/Atom feeds optimized for AI agents",

    image: `${SITE_URL}/og-image.png`,
    favicon: `${SITE_URL}/favicon.ico`,
    copyright: `All rights reserved ${currentYear}, ${SITE_NAME}`,

    feedLinks: {
      rss2: `${SITE_URL}/docs/rss.xml`,
      json: `${SITE_URL}/docs/feed.json`,
      atom: `${SITE_URL}/docs/atom.xml`,
    },

    author: {
      name: `${SITE_NAME} Team`,
      link: SITE_URL,
    },
  });

  // Add all documentation pages to the feed
  const pages = source.getPages();

  for (const page of pages) {
    const publishedDate = resolvePageDate(page);

    feed.addItem({
      id: `${SITE_URL}${page.url}`,
      title: page.data.title,
      description: page.data.description || `Documentation for ${page.data.title}`,
      link: `${SITE_URL}${page.url}`,
      date: publishedDate,

      category: resolvePageCategory(page.url),

      author: [
        {
          name: `${SITE_NAME} Team`,
          link: SITE_URL,
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
    title: SITE_NAME,
    id: SITE_URL,
    link: SITE_URL,
    language: "en",
    description: "Curated RSS/Atom feeds optimized for AI agents and large language models",

    image: `${SITE_URL}/og-image.png`,
    favicon: `${SITE_URL}/favicon.ico`,
    copyright: `All rights reserved ${currentYear}, ${SITE_NAME}`,

    feedLinks: {
      rss2: `${SITE_URL}/rss.xml`,
      json: `${SITE_URL}/feed.json`,
      atom: `${SITE_URL}/atom.xml`,
    },

    author: {
      name: `${SITE_NAME} Team`,
      link: SITE_URL,
    },
  });

  // Add all pages
  const pages = source.getPages();

  for (const page of pages) {
    const publishedDate = resolvePageDate(page);

    feed.addItem({
      id: `${SITE_URL}${page.url}`,
      title: page.data.title,
      description: page.data.description || `${page.data.title}`,
      link: `${SITE_URL}${page.url}`,
      date: publishedDate,

      category: resolvePageCategory(page.url),

      author: [
        {
          name: `${SITE_NAME} Team`,
          link: SITE_URL,
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
    title: `${SITE_NAME} - Blog`,
    id: `${SITE_URL}/blog`,
    link: `${SITE_URL}/blog`,
    language: "en",
    description: "Latest updates and articles from AI Web Feeds",

    image: `${SITE_URL}/og-image.png`,
    favicon: `${SITE_URL}/favicon.ico`,
    copyright: `All rights reserved ${currentYear}, ${SITE_NAME}`,

    feedLinks: {
      rss2: `${SITE_URL}/blog/rss.xml`,
      json: `${SITE_URL}/blog/feed.json`,
      atom: `${SITE_URL}/blog/atom.xml`,
    },

    author: {
      name: `${SITE_NAME} Team`,
      link: SITE_URL,
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
