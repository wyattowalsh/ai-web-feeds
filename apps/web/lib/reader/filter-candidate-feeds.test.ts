import { describe, expect, it } from "vitest";

import { filterCandidateFeeds } from "./filter-candidate-feeds";

const feeds = [
  {
    id: "feed-1",
    title: "Agents",
    topics: ["agents"],
    tags: [],
    source_type: "blog",
    verified: true,
    is_active: true,
  },
  {
    id: "feed-2",
    title: "News",
    topics: ["news"],
    tags: [],
    source_type: "newsletter",
    verified: false,
    is_active: true,
  },
] as const;

describe("filterCandidateFeeds", () => {
  it("returns all feeds when filters are empty", () => {
    expect(
      filterCandidateFeeds([...feeds], {
        feedIds: [],
        sourceType: null,
        topics: [],
        verified: null,
      }),
    ).toHaveLength(2);
  });

  it("narrows to pinned feed ids", () => {
    const result = filterCandidateFeeds([...feeds], {
      feedIds: ["feed-2"],
      sourceType: null,
      topics: [],
      verified: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("feed-2");
  });
});
