import { describe, expect, it } from "vitest";

import {
  readerViewChipLabel,
  readerViewEmptyHeading,
  sortChipLabel,
  sortEmptyHeading,
  verifiedEmptyHeading,
} from "./filter-labels";

describe("filter-labels", () => {
  it("formats chip labels", () => {
    expect(readerViewChipLabel("unread")).toBe("View: Unread");
    expect(sortChipLabel("oldest")).toBe("Sort: Oldest first");
  });

  it("formats empty headings", () => {
    expect(readerViewEmptyHeading("starred")).toBe("No prepared articles in Starred view");
    expect(sortEmptyHeading("source")).toBe("No prepared articles sorted by By source");
    expect(verifiedEmptyHeading(true)).toBe("No prepared articles from verified sources");
    expect(verifiedEmptyHeading(false)).toBe("No prepared articles from unverified sources");
  });
});
