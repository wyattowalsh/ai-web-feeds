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
});
