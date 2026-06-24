import { describe, expect, it } from "vitest";

import type { Article } from "@/lib/db";
import { matchesSmartFilters } from "@/lib/filters/rule-engine";

const base: Article = {
  id: "a1",
  feedId: "f1",
  title: "Agents overview",
  link: "https://example.com",
  content: "tool use and planning",
  pubDate: Date.now(),
  topics: ["agents"],
  rawCategories: [],
  sourceTopics: ["agents"],
  enclosures: [],
  read: false,
  starred: false,
  archived: false,
  tags: ["research"],
  cachedAt: Date.now(),
  lastModified: Date.now(),
};

describe("matchesSmartFilters", () => {
  it("filters unread articles", () => {
    expect(matchesSmartFilters({ ...base, read: true }, { readStatus: "unread" })).toBe(false);
    expect(matchesSmartFilters(base, { readStatus: "unread" })).toBe(true);
  });

  it("matches search query substring", () => {
    expect(matchesSmartFilters(base, { searchQuery: "planning" })).toBe(true);
    expect(matchesSmartFilters(base, { searchQuery: "crypto" })).toBe(false);
  });
});
