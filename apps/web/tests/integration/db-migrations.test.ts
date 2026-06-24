import { describe, expect, it } from "vitest";

import { DB_NAME, DB_VERSION, STORES } from "@/lib/db/schema";

describe("indexeddb schema contract", () => {
  it("uses expected database name and version", () => {
    expect(DB_NAME).toBe("aiwebfeeds");
    expect(DB_VERSION).toBeGreaterThanOrEqual(2);
  });

  it("declares required stores for client features", () => {
    expect(STORES.ARTICLES).toBe("articles");
    expect(STORES.SYNC_QUEUE).toBe("syncQueue");
    expect(STORES.FOLDERS).toBe("folders");
    expect(STORES.SEARCH_INDEX).toBe("searchIndex");
  });
});
