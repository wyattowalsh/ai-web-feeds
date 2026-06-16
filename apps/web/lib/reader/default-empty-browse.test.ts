import { describe, expect, it } from "vitest";

import { DEFAULT_EMPTY_BROWSE } from "./default-empty-browse";

describe("DEFAULT_EMPTY_BROWSE", () => {
  it("matches the empty corpus schema", () => {
    expect(DEFAULT_EMPTY_BROWSE.corpus.is_empty).toBe(true);
    expect(DEFAULT_EMPTY_BROWSE.corpus.schema_version).toBe("articles-3.0.0");
    expect(DEFAULT_EMPTY_BROWSE.items).toEqual([]);
    expect(DEFAULT_EMPTY_BROWSE.total_matched).toBe(0);
  });
});
