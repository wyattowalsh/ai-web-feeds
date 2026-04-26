import type { MetadataRoute } from "next";
import { loadArticleCorpus } from "@/lib/article-corpus";
import { loadFeedCatalog } from "@/lib/feeds";
import { getSourcePath, getTopicPath, loadTopicCatalog } from "@/lib/public-content";
import { DEFAULT_LAST_MODIFIED, parseDateOrDefault, SITE_URL } from "@/lib/seo";
import { source } from "@/lib/source";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = source.getPages();
  const feedsData = loadFeedCatalog();
  const topics = loadTopicCatalog();
  const articleCorpus = await loadArticleCorpus();

  const docUrls: MetadataRoute.Sitemap = pages
    .filter((page) => page.url !== "/docs")
    .map((page) => ({
      url: `${SITE_URL}${page.url}`,
      lastModified: getPageLastModified(page.data as unknown as Record<string, unknown>),
      changeFrequency: "weekly",
      priority: 0.72,
    }));

  const sourceUrls: MetadataRoute.Sitemap = feedsData.sources.map((feed) => ({
    url: `${SITE_URL}${getSourcePath(feed)}`,
    lastModified: parseDateOrDefault(feed.updated_at ?? feedsData.metadata?.last_updated),
    changeFrequency: "weekly",
    priority: 0.74,
  }));

  const topicUrls: MetadataRoute.Sitemap = topics.map((topic) => ({
    url: `${SITE_URL}${getTopicPath(topic.id)}`,
    lastModified: parseDateOrDefault(feedsData.metadata?.last_updated),
    changeFrequency: "weekly",
    priority: 0.76,
  }));

  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: DEFAULT_LAST_MODIFIED,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/reader`,
      lastModified: parseDateOrDefault(articleCorpus.metadata.latest_published_at),
      changeFrequency: "daily",
      priority: 0.96,
    },
    {
      url: `${SITE_URL}/sources`,
      lastModified: parseDateOrDefault(feedsData.metadata?.last_updated),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/topics`,
      lastModified: parseDateOrDefault(feedsData.metadata?.last_updated),
      changeFrequency: "weekly",
      priority: 0.82,
    },
    {
      url: `${SITE_URL}/dashboard`,
      lastModified: parseDateOrDefault(feedsData.metadata?.last_updated),
      changeFrequency: "weekly",
      priority: 0.68,
    },
    {
      url: `${SITE_URL}/docs`,
      lastModified: DEFAULT_LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.82,
    },
  ];

  return [...staticUrls, ...sourceUrls, ...topicUrls, ...docUrls];
}

function getPageLastModified(pageData: Record<string, unknown>): Date {
  const value = pageData.lastModified ?? pageData.date;
  return parseDateOrDefault(typeof value === "string" ? value : null);
}
