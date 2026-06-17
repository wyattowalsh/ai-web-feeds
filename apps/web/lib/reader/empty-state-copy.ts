import type { FeedsWorkspaceInitialState } from "@/lib/reader-route-types";

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

  return null;
}
