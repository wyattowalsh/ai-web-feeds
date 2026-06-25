import { describe, expect, it } from "vitest";

import { normalizeSavedReaderFilterPayload, READER_FILTER_SCHEMA_VERSION } from "./reader-filter";

describe("reader-filter contract", () => {
  it("normalizes partial payloads with defaults", () => {
    const payload = normalizeSavedReaderFilterPayload({
      query: "  agent  ",
      topics: ["agents", 1 as unknown as string],
    });

    expect(payload).toEqual({
      query: "  agent  ",
      feedIds: [],
      sourceType: null,
      topics: ["agents"],
      verified: null,
      sort: "latest",
      readerView: "latest",
    });
    expect(READER_FILTER_SCHEMA_VERSION).toBe("reader-filter-v1");
  });
});
