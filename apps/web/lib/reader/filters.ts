import type { FeedSource } from "@/lib/feeds-filters";
import type { FeedsWorkspaceInitialState } from "@/lib/reader-route";
import type {
  ArticleSort,
  FeedSliceFilters,
  FilterChip,
  ReaderArticleState,
  ReaderDraftState,
  ReaderView,
  VerifiedDraftValue,
} from "./types";

export function normalizeTopicsValue(topics: string[]): string {
  return topics.join(",");
}

export function parseTopicsValue(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((topic) => topic.trim())
        .filter(Boolean),
    ),
  );
}

export function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export function toVerifiedDraftValue(value: boolean | null): VerifiedDraftValue {
  if (value === true) {
    return "true";
  }

  if (value === false) {
    return "false";
  }

  return "";
}

export function normalizeQueryDraft(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function matchesDraftState(
  drafts: ReaderDraftState,
  state: FeedsWorkspaceInitialState,
): boolean {
  return (
    normalizeQueryDraft(drafts.query) === state.query &&
    (drafts.sourceType || null) === state.sourceType &&
    arraysEqual(drafts.topics, state.topics) &&
    toVerifiedDraftValue(state.verified) === drafts.verified &&
    drafts.readerView === state.readerView &&
    drafts.sort === state.sort
  );
}

export function toggleTopic(topics: string[], topic: string): string[] {
  if (topics.includes(topic)) {
    return topics.filter((entry) => entry !== topic);
  }

  return [...topics, topic];
}

export function matchesFeedSlice(feed: FeedSource, filters: FeedSliceFilters): boolean {
  const feedId = feed.id ?? "";
  if (filters.feedIds.length > 0 && !filters.feedIds.includes(feedId)) {
    return false;
  }

  if (filters.sourceType && feed.source_type !== filters.sourceType) {
    return false;
  }

  if (typeof filters.verified === "boolean" && feed.verified !== filters.verified) {
    return false;
  }

  if (filters.topics.length > 0) {
    const feedTopics = new Set([...(feed.topics ?? []), ...(feed.tags ?? [])]);
    if (!filters.topics.some((topic) => feedTopics.has(topic))) {
      return false;
    }
  }

  return feed.is_active !== false;
}

export function matchesReaderView(view: ReaderView, state: ReaderArticleState): boolean {
  if (view === "unread") {
    return !state.read && !state.archived;
  }

  if (view === "starred") {
    return state.starred && !state.archived;
  }

  if (view === "saved") {
    return state.bookmarked && !state.archived;
  }

  if (view === "archived") {
    return state.archived;
  }

  return !state.archived;
}

export function buildCurrentFilterChips(
  state: FeedsWorkspaceInitialState,
  feedLookup: Map<string, FeedSource>,
): FilterChip[] {
  const chips: FilterChip[] = [];

  if (state.query) {
    chips.push({
      key: "query",
      label: `Search: ${state.query}`,
      overrides: { q: null, cursor: null },
    });
  }

  if (state.sourceType) {
    chips.push({
      key: "sourceType",
      label: `Type: ${state.sourceType}`,
      overrides: { source_type: null, cursor: null },
    });
  }

  for (const topic of state.topics) {
    chips.push({
      key: `topic:${topic}`,
      label: `Topic: ${topic}`,
      overrides: {
        topics: normalizeTopicsValue(state.topics.filter((entry) => entry !== topic)) || null,
        cursor: null,
      },
    });
  }

  if (state.verified === true) {
    chips.push({
      key: "verified:true",
      label: "Verified only",
      overrides: { verified: null, cursor: null },
    });
  } else if (state.verified === false) {
    chips.push({
      key: "verified:false",
      label: "Unverified only",
      overrides: { verified: null, cursor: null },
    });
  }

  if (state.readerView !== "latest") {
    const labels: Record<Exclude<ReaderView, "latest">, string> = {
      unread: "Unread",
      starred: "Starred",
      saved: "Saved",
      archived: "Archived",
    };
    chips.push({
      key: "readerView",
      label: `View: ${labels[state.readerView as Exclude<ReaderView, "latest">]}`,
      overrides: { reader_view: null },
    });
  }

  if (state.sort !== "latest") {
    const labels: Record<Exclude<ArticleSort, "latest">, string> = {
      oldest: "Oldest first",
      source: "By source",
    };
    chips.push({
      key: "sort",
      label: `Sort: ${labels[state.sort as Exclude<ArticleSort, "latest">]}`,
      overrides: { sort: null, cursor: null },
    });
  }

  for (const feedId of state.feedIds) {
    const feed = feedLookup.get(feedId);
    chips.push({
      key: `feed:${feedId}`,
      label: `Source: ${feed?.title ?? feedId}`,
      overrides: {
        feed: state.feedIds.filter((entry) => entry !== feedId),
        cursor: null,
      },
    });
  }

  return chips;
}

export { getSourceTypes as getSourceTypesFromFeeds } from "@/lib/feeds-filters";
