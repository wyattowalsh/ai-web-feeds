import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";

import { useReaderFeedSlice } from "./use-reader-feed-slice";

const feeds = [
  {
    id: "feed-1",
    title: "Agents",
    topics: ["agents"],
    tags: ["ml"],
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
  {
    title: "No id feed",
    topics: [],
    tags: [],
    source_type: "blog",
    verified: false,
    is_active: true,
  },
] as const;

describe("useReaderFeedSlice", () => {
  it("filters candidate feeds by pinned feed ids", () => {
    const { result } = renderHook(() =>
      useReaderFeedSlice({
        feeds: [...feeds],
        currentState: {
          feedIds: ["feed-1"],
          sourceType: null,
          topics: [],
          verified: null,
        },
      }),
    );

    expect(result.current.candidateFeeds.map((feed) => feed.id)).toEqual(["feed-1"]);
  });

  it("filters by source type, topics, and verification", () => {
    const { result } = renderHook(() =>
      useReaderFeedSlice({
        feeds: [...feeds],
        currentState: {
          feedIds: [],
          sourceType: "blog",
          topics: ["agents"],
          verified: true,
        },
      }),
    );

    expect(result.current.candidateFeeds).toHaveLength(1);
    expect(result.current.candidateFeeds[0]?.id).toBe("feed-1");
  });

  it("builds feed lookup with string ids only", () => {
    const { result } = renderHook(() =>
      useReaderFeedSlice({
        feeds: [...feeds],
        currentState: {
          feedIds: [],
          sourceType: null,
          topics: [],
          verified: null,
        },
      }),
    );

    expect(result.current.feedLookup.size).toBe(2);
    expect(result.current.feedLookup.get("feed-1")?.title).toBe("Agents");
    expect(result.current.feedLookup.has("feed-2")).toBe(true);
  });

  it("returns empty candidate feeds when nothing matches", () => {
    const { result } = renderHook(() =>
      useReaderFeedSlice({
        feeds: [],
        currentState: {
          feedIds: ["missing"],
          sourceType: "podcast",
          topics: ["space"],
          verified: true,
        },
      }),
    );

    expect(result.current.candidateFeeds).toEqual([]);
    expect(result.current.feedLookup.size).toBe(0);
  });
});
