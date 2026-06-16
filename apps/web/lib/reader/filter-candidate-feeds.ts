import type { FeedSource } from "@/lib/feeds-filters";

import { matchesFeedSlice } from "./filters";
import type { FeedSliceFilters } from "./types";

export function filterCandidateFeeds(feeds: FeedSource[], filters: FeedSliceFilters): FeedSource[] {
  return feeds.filter((feed) => matchesFeedSlice(feed, filters));
}
