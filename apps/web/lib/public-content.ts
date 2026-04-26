import "server-only";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parse } from "yaml";

import { loadArticleCorpus, type ArticleCorpusArticle } from "@/lib/article-corpus";
import { loadFeedCatalog, type FeedSource } from "@/lib/feeds";
import { getSourcePath, getSourceSlug, getTopicPath, slugifyPathSegment } from "@/lib/public-paths";

export { getSourcePath, getSourceSlug, getTopicPath, slugifyPathSegment };

export type TopicRecord = {
  id: string;
  label: string;
  description: string | null;
  aliases: string[];
  facet?: string;
  facet_group?: string;
  parents: string[];
};

type TopicsPayload = {
  topics?: TopicRecord[];
};

const ARTICLE_PREFIX = "/articles";

function getDataDirectory(): string {
  return join(process.cwd(), "../../data");
}

export function getArticleSlug(article: Pick<ArticleCorpusArticle, "id" | "title" | "link">) {
  const titleSlug = slugifyPathSegment(article.title).slice(0, 72).replace(/-+$/, "");
  const digest = createHash("sha1")
    .update(article.id || article.link || article.title)
    .digest("hex")
    .slice(0, 10);

  return `${titleSlug || "article"}-${digest}`;
}

export function getArticlePath(article: Pick<ArticleCorpusArticle, "id" | "title" | "link">) {
  return `${ARTICLE_PREFIX}/${getArticleSlug(article)}`;
}

export function getSourceBySlug(slug: string): FeedSource | null {
  return loadFeedCatalog().sources.find((source) => getSourceSlug(source) === slug) ?? null;
}

export function loadTopicCatalog(): TopicRecord[] {
  try {
    const content = readFileSync(join(getDataDirectory(), "topics.yaml"), "utf-8");
    const payload = parse(content) as TopicsPayload;
    return (payload.topics ?? []).map(normalizeTopicRecord);
  } catch {
    return [];
  }
}

export function getTopicBySlug(slug: string): TopicRecord | null {
  return (
    loadTopicCatalog().find(
      (topic) => slugifyPathSegment(topic.id) === slug || topic.aliases.includes(slug),
    ) ?? null
  );
}

export function getSourcesForTopic(topicId: string): FeedSource[] {
  return loadFeedCatalog().sources.filter((source) => source.topics?.includes(topicId));
}

export async function getArticleBySlug(slug: string): Promise<ArticleCorpusArticle | null> {
  const corpus = await loadArticleCorpus();
  if (corpus.metadata.is_empty) {
    return null;
  }

  return corpus.articles.find((article) => getArticleSlug(article) === slug) ?? null;
}

export function getSourceTitle(source: FeedSource): string {
  return source.title?.trim() || source.id || source.url;
}

export function truncateDescription(value: string | null | undefined, fallback: string): string {
  const normalized = normalizeWhitespace(value ?? fallback);
  if (normalized.length <= 155) {
    return normalized;
  }

  return `${normalized.slice(0, 152).replace(/\s+\S*$/, "")}...`;
}

export function articleExcerpt(article: Pick<ArticleCorpusArticle, "summary" | "content_html">) {
  const plainSummary = normalizeWhitespace(article.summary ?? "");
  if (plainSummary) {
    return truncateDescription(plainSummary, plainSummary);
  }

  const plainContent = normalizeWhitespace((article.content_html ?? "").replace(/<[^>]*>/g, " "));
  return truncateDescription(
    plainContent,
    "A recent AI article tracked by the AI Web Feeds reader.",
  );
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTopicRecord(record: TopicRecord): TopicRecord {
  return {
    ...record,
    aliases: Array.isArray(record.aliases) ? record.aliases.map(slugifyPathSegment) : [],
    parents: Array.isArray(record.parents) ? record.parents : [],
    description: typeof record.description === "string" ? record.description : null,
  };
}
