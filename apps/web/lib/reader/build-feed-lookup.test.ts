import { describe, expect, it } from "vitest";

import { buildFeedLookup } from "./build-feed-lookup";

describe("buildFeedLookup", () => {
  it("indexes feeds with string ids", () => {
    const lookup = buildFeedLookup([
      { id: "feed-1", title: "One" },
      { id: "feed-2", title: "Two" },
      { title: "Missing id" },
    ] as never);

    expect(lookup.size).toBe(2);
    expect(lookup.get("feed-1")?.title).toBe("One");
  });
});
