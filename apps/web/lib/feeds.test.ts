import { describe, expect, it } from "vitest";

import { getFeedStats, type FeedSource } from "./feeds";

describe("getFeedStats", () => {
  it("keeps metadata availability separate from catalog counts", () => {
    const feeds: FeedSource[] = [
      {
        id: "feed-1",
        title: "Agent Feed",
        url: "https://example.com/feed-1.xml",
        source_type: "blog",
        topics: ["agents"],
      },
      {
        id: "feed-2",
        title: "Reader Signals",
        url: "https://example.com/feed-2.xml",
        source_type: "newsletter",
        topics: ["ml"],
      },
    ];

    expect(getFeedStats(feeds)).toEqual(
      expect.objectContaining({
        total: 2,
        verified: 0,
        active: 0,
        hasVerificationMetadata: false,
        hasActivityMetadata: false,
        sourceTypeCount: 2,
        topicCount: 2,
      }),
    );
  });

  it("counts explicit verification and activity metadata when present", () => {
    const feeds: FeedSource[] = [
      {
        id: "feed-1",
        title: "Agent Feed",
        url: "https://example.com/feed-1.xml",
        source_type: "blog",
        topics: ["agents"],
        verified: true,
        is_active: true,
      },
      {
        id: "feed-2",
        title: "Dormant Feed",
        url: "https://example.com/feed-2.xml",
        source_type: "podcast",
        topics: ["ml"],
        verified: false,
        is_active: false,
      },
    ];

    expect(getFeedStats(feeds)).toEqual(
      expect.objectContaining({
        total: 2,
        verified: 1,
        active: 1,
        hasVerificationMetadata: true,
        hasActivityMetadata: true,
        sourceTypeCount: 2,
        topicCount: 2,
      }),
    );
  });
});
