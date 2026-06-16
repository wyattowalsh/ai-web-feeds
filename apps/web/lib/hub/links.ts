import { CANONICAL_CATALOG_PATH, CANONICAL_READER_PATH } from "@/lib/reader-routes";
import type { HubNavItem } from "./types";

export const HUB_ROUTES = {
  home: "/",
  reader: CANONICAL_READER_PATH,
  sources: CANONICAL_CATALOG_PATH,
  topics: "/topics",
  dashboard: "/dashboard",
  search: "/search",
  forYou: "/for-you",
  blog: "/blog",
  docs: "/docs",
} as const;

export const PRIMARY_HUB_NAV: HubNavItem[] = [
  { label: "Reader", href: HUB_ROUTES.reader, description: "Focused article stream" },
  { label: "Search", href: HUB_ROUTES.search, description: "Search corpus and live posts" },
  { label: "For You", href: HUB_ROUTES.forYou, description: "Recommendations and digests" },
  { label: "Sources", href: HUB_ROUTES.sources, description: "Browse feed catalog" },
  { label: "Topics", href: HUB_ROUTES.topics, description: "Topic taxonomy" },
  { label: "Blog", href: HUB_ROUTES.blog, description: "Product updates" },
  { label: "Dashboard", href: HUB_ROUTES.dashboard, description: "Corpus health" },
  { label: "Docs", href: HUB_ROUTES.docs, description: "Guides and API" },
];

export function getTopicPath(topicId: string): string {
  return `/topics/${encodeURIComponent(topicId)}`;
}

export function getSourcePath(sourceId: string): string {
  return `/sources/${encodeURIComponent(sourceId)}`;
}

export function getSearchPath(query?: string): string {
  if (!query?.trim()) {
    return HUB_ROUTES.search;
  }
  return `${HUB_ROUTES.search}?q=${encodeURIComponent(query.trim())}`;
}
