import { describe, expect, it } from "vitest";

import {
  buildCurrentFilterChips,
  matchesReaderView,
  normalizeTopicsValue,
  parseTopicsValue,
  toggleTopic,
} from "./filters";
import { DEFAULT_ARTICLE_STATE } from "./constants";

describe("reader filters", () => {
  it("normalizes and parses topics", () => {
    expect(normalizeTopicsValue(["ai", "ml"])).toBe("ai,ml");
    expect(parseTopicsValue("ai, ml, ai")).toEqual(["ai", "ml"]);
  });

  it("toggles topics", () => {
    expect(toggleTopic(["ai"], "ml")).toEqual(["ai", "ml"]);
    expect(toggleTopic(["ai", "ml"], "ai")).toEqual(["ml"]);
  });

  it("matches reader views", () => {
    expect(matchesReaderView("unread", DEFAULT_ARTICLE_STATE)).toBe(true);
    expect(matchesReaderView("unread", { ...DEFAULT_ARTICLE_STATE, read: true })).toBe(false);
    expect(matchesReaderView("starred", { ...DEFAULT_ARTICLE_STATE, starred: true })).toBe(true);
  });

  it("builds filter chips from state", () => {
    const chips = buildCurrentFilterChips(
      {
        query: "transformers",
        feedIds: [],
        sourceType: "blog",
        topics: ["ai"],
        verified: true,
        sort: "latest",
        readerView: "unread",
        cursor: 0,
        limit: 24,
      },
      new Map(),
    );

    expect(chips.some((chip) => chip.key === "query")).toBe(true);
    expect(chips.some((chip) => chip.key === "verified:true")).toBe(true);
    expect(chips.some((chip) => chip.key === "readerView")).toBe(true);
  });
});
