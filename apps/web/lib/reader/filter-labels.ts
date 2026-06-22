import type { ArticleSort, ReaderView } from "./types";

export const READER_VIEW_LABELS: Record<Exclude<ReaderView, "latest">, string> = {
  unread: "Unread",
  starred: "Starred",
  saved: "Saved",
  archived: "Archived",
};

export const SORT_LABELS: Record<Exclude<ArticleSort, "latest">, string> = {
  oldest: "Oldest first",
  source: "By source",
};

export function readerViewChipLabel(view: Exclude<ReaderView, "latest">): string {
  return `View: ${READER_VIEW_LABELS[view]}`;
}

export function sortChipLabel(sort: Exclude<ArticleSort, "latest">): string {
  return `Sort: ${SORT_LABELS[sort]}`;
}

export function readerViewEmptyHeading(view: Exclude<ReaderView, "latest">): string {
  return `No prepared articles in ${READER_VIEW_LABELS[view]} view`;
}

export function sortEmptyHeading(sort: Exclude<ArticleSort, "latest">): string {
  return `No prepared articles sorted by ${SORT_LABELS[sort]}`;
}

export function verifiedEmptyHeading(verified: boolean): string {
  return verified
    ? "No prepared articles from verified sources"
    : "No prepared articles from unverified sources";
}
