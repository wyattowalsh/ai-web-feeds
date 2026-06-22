import { describe, expect, it } from "vitest";

import { getFilteredEmptyHeading } from "./empty-state-copy";

describe("getFilteredEmptyHeading", () => {
  it("returns query-specific heading", () => {
    expect(
      getFilteredEmptyHeading({
        query: "agent",
        feedIds: [],
        sourceType: null,
        topics: [],
        verified: null,
        sort: "latest",
        readerView: "latest",
        cursor: 0,
      }),
    ).toBe("No prepared matches for “agent”");
  });

  it("returns null when no filters apply", () => {
    expect(
      getFilteredEmptyHeading({
        query: "",
        feedIds: [],
        sourceType: null,
        topics: [],
        verified: null,
        sort: "latest",
        readerView: "latest",
        cursor: 0,
      }),
    ).toBeNull();
  });

  it("returns reader view heading", () => {
    expect(
      getFilteredEmptyHeading({
        query: "",
        feedIds: [],
        sourceType: null,
        topics: [],
        verified: null,
        sort: "latest",
        readerView: "unread",
        cursor: 0,
      }),
    ).toBe("No prepared articles in Unread view");
  });

  it("returns sort heading", () => {
    expect(
      getFilteredEmptyHeading({
        query: "",
        feedIds: [],
        sourceType: null,
        topics: [],
        verified: null,
        sort: "oldest",
        readerView: "latest",
        cursor: 0,
      }),
    ).toBe("No prepared articles sorted by Oldest first");
  });

  it("returns verified heading", () => {
    expect(
      getFilteredEmptyHeading({
        query: "",
        feedIds: [],
        sourceType: null,
        topics: [],
        verified: true,
        sort: "latest",
        readerView: "latest",
        cursor: 0,
      }),
    ).toBe("No prepared articles from verified sources");
  });
});
