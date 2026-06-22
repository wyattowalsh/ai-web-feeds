import type { FeedsWorkspaceInitialState } from "@/lib/reader-route-types";

import { readerViewEmptyHeading, sortEmptyHeading, verifiedEmptyHeading } from "./filter-labels";
import type { ArticleSort, ReaderView } from "./types";

export function getFilteredEmptyHeading(state: FeedsWorkspaceInitialState): string | null {
  if (state.query.trim()) {
    return `No prepared matches for “${state.query.trim()}”`;
  }

  if (state.feedIds.length > 0) {
    return "No prepared articles for the selected source";
  }

  if (state.sourceType) {
    return `No prepared articles for ${state.sourceType} sources`;
  }

  if (state.topics.length > 0) {
    return "No prepared articles for the selected topics";
  }

  if (state.readerView !== "latest") {
    return readerViewEmptyHeading(state.readerView as Exclude<ReaderView, "latest">);
  }

  if (state.sort !== "latest") {
    return sortEmptyHeading(state.sort as Exclude<ArticleSort, "latest">);
  }

  if (state.verified === true) {
    return verifiedEmptyHeading(true);
  }

  if (state.verified === false) {
    return verifiedEmptyHeading(false);
  }

  return null;
}
