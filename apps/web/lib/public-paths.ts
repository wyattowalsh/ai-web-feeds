import type { FeedSource } from "@/lib/feeds";

const SOURCE_PREFIX = "/sources";
const TOPIC_PREFIX = "/topics";

export function slugifyPathSegment(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "item";
}

export function getSourceSlug(source: Pick<FeedSource, "id" | "title" | "url">): string {
  if (source.id && isOpaqueCatalogId(source.id) && source.title) {
    return `${slugifyPathSegment(source.title)}-${source.id.slice(0, 8).toLowerCase()}`;
  }

  const preferredValue = source.id ?? source.title ?? source.url;

  return slugifyPathSegment(preferredValue);
}

export function getSourcePath(source: Pick<FeedSource, "id" | "title" | "url">): string {
  return `${SOURCE_PREFIX}/${getSourceSlug(source)}`;
}

export function getTopicPath(topicId: string): string {
  return `${TOPIC_PREFIX}/${slugifyPathSegment(topicId)}`;
}

function isOpaqueCatalogId(value: string): boolean {
  return /^[a-f0-9]{12,}$/i.test(value.trim());
}
