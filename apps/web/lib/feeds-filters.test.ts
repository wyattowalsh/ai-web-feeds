import { describe, expect, it } from "vitest";
import { normalizeFilterToken, normalizeTopicValues } from "@/lib/catalog-types";
import {
  filterBySourceType,
  filterByTopic,
  filterByVerified,
  getTopics,
} from "@/lib/feeds-filters";

const FEEDS = [
  {
    title: "AI Blog",
    url: "https://example.com/blog.xml",
    source_type: " Blog ",
    topics: [" AI ", "ML"],
    verified: true,
  },
  {
    title: "Agent Podcast",
    url: "https://example.com/podcast.xml",
    source_type: "podcast",
    topics: "agents, ai, Agents",
    verified: false,
  },
] as const;

describe("feeds-filters", () => {
  it("normalizes filter tokens and topic lists", () => {
    expect(normalizeFilterToken("  BLOG  ")).toBe("blog");
    expect(normalizeTopicValues([" AI ", "ai", "agents"])).toEqual(["AI", "agents"]);
    expect(normalizeTopicValues("agents, ai, Agents")).toEqual(["agents", "ai"]);
  });

  it("matches source types and topics case-insensitively", () => {
    expect(filterBySourceType([...FEEDS], "blog")).toHaveLength(1);
    expect(filterByTopic([...FEEDS], "ai")).toHaveLength(2);
    expect(filterByTopic([...FEEDS], "agents")).toHaveLength(1);
  });

  it("filters by verified state and returns unique trimmed topics", () => {
    expect(filterByVerified([...FEEDS], true)).toHaveLength(1);
    expect(getTopics([...FEEDS])).toEqual(["agents", "AI", "ML"]);
  });
});
