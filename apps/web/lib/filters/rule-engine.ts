import type { Article } from "@/lib/db";
import type { CustomViewFilters } from "@/lib/organization/custom-view-schema";

export function matchesSmartFilters(article: Article, filters: CustomViewFilters): boolean {
  if (filters.readStatus === "read" && !article.read) return false;
  if (filters.readStatus === "unread" && article.read) return false;
  if (filters.starred === true && !article.starred) return false;

  if (filters.topics?.length) {
    const topics = [...article.topics, ...article.sourceTopics];
    if (!filters.topics.some((topic) => topics.includes(topic))) return false;
  }

  if (filters.tags?.length) {
    if (!filters.tags.some((tag) => article.tags.includes(tag))) return false;
  }

  if (filters.searchQuery?.trim()) {
    const q = filters.searchQuery.trim().toLowerCase();
    const haystack = `${article.title} ${article.summary ?? ""} ${article.content}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  if (filters.dateRange?.from || filters.dateRange?.to) {
    const pub = article.pubDate;
    if (filters.dateRange.from && pub < Date.parse(filters.dateRange.from)) return false;
    if (filters.dateRange.to && pub > Date.parse(filters.dateRange.to)) return false;
  }

  return true;
}
