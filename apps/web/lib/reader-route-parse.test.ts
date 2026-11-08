import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseCursor,
  parseInitialState,
  parseLimit,
  parseMode,
  parseReaderView,
  parseSort,
} from "./reader-route-parse";

const source = readFileSync(join(process.cwd(), "lib/reader-route-parse.ts"), "utf8");

const EXPORTED_FUNCTIONS = [
  "parseMode",
  "parseSort",
  "parseReaderView",
  "parseCursor",
  "parseLimit",
  "parseInitialState",
] as const;

const EMPTY_INITIAL_STATE = {
  query: "",
  feedIds: [],
  sourceType: null,
  topics: [],
  verified: null,
  sort: "latest",
  readerView: "latest",
  cursor: 0,
  limit: 24,
} as const;

function params(entries: Array<[string, string]> = []): URLSearchParams {
  const searchParams = new URLSearchParams();

  for (const [key, value] of entries) {
    searchParams.append(key, value);
  }

  return searchParams;
}

describe("parseMode", () => {
  it("defaults missing, blank, and unknown modes to reader", () => {
    expect(parseMode(params())).toBe("reader");
    expect(parseMode(params([["mode", ""]]))).toBe("reader");
    expect(parseMode(params([["mode", "   "]]))).toBe("reader");
    expect(parseMode(params([["mode", "reader"]]))).toBe("reader");
    expect(parseMode(params([["mode", "catalogue"]]))).toBe("reader");
    expect(parseMode(params([["mode", "sources"]]))).toBe("reader");
  });

  it("accepts catalog regardless of case and surrounding space", () => {
    expect(parseMode(params([["mode", "catalog"]]))).toBe("catalog");
    expect(parseMode(params([["mode", " Catalog "]]))).toBe("catalog");
    expect(parseMode(params([["mode", "CATALOG"]]))).toBe("catalog");
  });
});

describe("parseSort", () => {
  it("defaults missing, blank, and other sorts to latest", () => {
    expect(parseSort(params())).toBe("latest");
    expect(parseSort(params([["sort", ""]]))).toBe("latest");
    expect(parseSort(params([["sort", "   "]]))).toBe("latest");
    expect(parseSort(params([["sort", "latest"]]))).toBe("latest");
    expect(parseSort(params([["sort", "LATEST"]]))).toBe("latest");
    expect(parseSort(params([["sort", "newest"]]))).toBe("latest");
    expect(parseSort(params([["sort", "sources"]]))).toBe("latest");
  });

  it("accepts oldest and source regardless of case and surrounding space", () => {
    expect(parseSort(params([["sort", "oldest"]]))).toBe("oldest");
    expect(parseSort(params([["sort", " Oldest "]]))).toBe("oldest");
    expect(parseSort(params([["sort", "SOURCE"]]))).toBe("source");
    expect(parseSort(params([["sort", " source "]]))).toBe("source");
  });
});

describe("parseReaderView", () => {
  it("defaults missing, blank, and other reader views to latest", () => {
    expect(parseReaderView(params())).toBe("latest");
    expect(parseReaderView(params([["reader_view", ""]]))).toBe("latest");
    expect(parseReaderView(params([["reader_view", "   "]]))).toBe("latest");
    expect(parseReaderView(params([["reader_view", "latest"]]))).toBe("latest");
    expect(parseReaderView(params([["reader_view", "LATEST"]]))).toBe("latest");
    expect(parseReaderView(params([["reader_view", "read"]]))).toBe("latest");
    expect(parseReaderView(params([["reader_view", "all"]]))).toBe("latest");
  });

  it("accepts unread, starred, saved, and archived regardless of case and surrounding space", () => {
    expect(parseReaderView(params([["reader_view", "unread"]]))).toBe("unread");
    expect(parseReaderView(params([["reader_view", " UNREAD "]]))).toBe("unread");
    expect(parseReaderView(params([["reader_view", "starred"]]))).toBe("starred");
    expect(parseReaderView(params([["reader_view", "Starred"]]))).toBe("starred");
    expect(parseReaderView(params([["reader_view", "saved"]]))).toBe("saved");
    expect(parseReaderView(params([["reader_view", " SAVED "]]))).toBe("saved");
    expect(parseReaderView(params([["reader_view", "archived"]]))).toBe("archived");
    expect(parseReaderView(params([["reader_view", "Archived"]]))).toBe("archived");
  });
});

describe("parseCursor", () => {
  it("uses zero for a missing, blank, non-numeric, or negative cursor", () => {
    expect(parseCursor(params())).toBe(0);
    expect(parseCursor(params([["cursor", ""]]))).toBe(0);
    expect(parseCursor(params([["cursor", "   "]]))).toBe(0);
    expect(parseCursor(params([["cursor", "abc"]]))).toBe(0);
    expect(parseCursor(params([["cursor", "-1"]]))).toBe(0);
    expect(parseCursor(params([["cursor", "-20"]]))).toBe(0);
  });

  it("truncates a non-negative cursor and does not apply an upper bound", () => {
    expect(parseCursor(params([["cursor", "0"]]))).toBe(0);
    expect(parseCursor(params([["cursor", "1"]]))).toBe(1);
    expect(parseCursor(params([["cursor", "15.9"]]))).toBe(15);
    expect(parseCursor(params([["cursor", "  12"]]))).toBe(12);
    expect(parseCursor(params([["cursor", "101"]]))).toBe(101);
    expect(parseCursor(params([["cursor", "10000"]]))).toBe(10000);
  });
});

describe("parseLimit", () => {
  it("uses 24 for a missing, blank, or non-numeric limit", () => {
    expect(parseLimit(params())).toBe(24);
    expect(parseLimit(params([["limit", ""]]))).toBe(24);
    expect(parseLimit(params([["limit", "   "]]))).toBe(24);
    expect(parseLimit(params([["limit", "abc"]]))).toBe(24);
    expect(parseLimit(params([["limit", "Infinity"]]))).toBe(24);
  });

  it("truncates a finite limit and clamps it to the inclusive range 1 through 100", () => {
    expect(parseLimit(params([["limit", "0"]]))).toBe(1);
    expect(parseLimit(params([["limit", "-4"]]))).toBe(1);
    expect(parseLimit(params([["limit", "0.9"]]))).toBe(1);
    expect(parseLimit(params([["limit", "1"]]))).toBe(1);
    expect(parseLimit(params([["limit", "24"]]))).toBe(24);
    expect(parseLimit(params([["limit", "50.9"]]))).toBe(50);
    expect(parseLimit(params([["limit", "  30"]]))).toBe(30);
    expect(parseLimit(params([["limit", "100"]]))).toBe(100);
    expect(parseLimit(params([["limit", "100.9"]]))).toBe(100);
    expect(parseLimit(params([["limit", "101"]]))).toBe(100);
    expect(parseLimit(params([["limit", "1000"]]))).toBe(100);
  });
});

describe("parseInitialState", () => {
  it("uses empty filters and the current defaults when params are empty", () => {
    expect(parseInitialState(params())).toEqual(EMPTY_INITIAL_STATE);
    expect(parseInitialState(params([["mode", "catalog"]]))).toEqual(EMPTY_INITIAL_STATE);
  });

  it("drops invalid enums and blank query, topics, feeds, and source type instead of inventing values", () => {
    expect(
      parseInitialState(
        params([
          ["sort", "newest"],
          ["reader_view", "read"],
          ["verified", "yes"],
          ["source_type", "   "],
          ["q", "   "],
          ["topics", ",,"],
          ["topics", "   "],
          ["feed", " "],
          ["feed", ""],
        ]),
      ),
    ).toEqual(EMPTY_INITIAL_STATE);
  });

  it("clamps cursor and limit without filling in query or topics", () => {
    expect(
      parseInitialState(
        params([
          ["cursor", "-5"],
          ["limit", "0"],
        ]),
      ),
    ).toEqual({
      ...EMPTY_INITIAL_STATE,
      cursor: 0,
      limit: 1,
    });

    expect(
      parseInitialState(
        params([
          ["cursor", "40.8"],
          ["limit", "250"],
        ]),
      ),
    ).toEqual({
      ...EMPTY_INITIAL_STATE,
      cursor: 40,
      limit: 100,
    });
  });

  it("passes query and topics through without adding values", () => {
    expect(
      parseInitialState(
        params([
          ["q", "transformers"],
          ["topics", "Reasoning Models"],
          ["topics", "reasoning   models"],
        ]),
      ),
    ).toEqual({
      ...EMPTY_INITIAL_STATE,
      query: "transformers",
      topics: ["reasoning models"],
    });

    expect(
      parseInitialState(
        params([
          ["q", "  OpenAI   agents  "],
          ["topics", "Agents"],
          ["topics", "ml, Agents"],
          ["feed", "OpenAI"],
          ["feed", " OpenAI "],
          ["feed", ""],
          ["feed", "anthropic"],
          ["source_type", " Blog "],
          ["verified", " FALSE "],
          ["sort", "source"],
          ["reader_view", "archived"],
          ["cursor", "7.8"],
          ["limit", "100"],
        ]),
      ),
    ).toEqual({
      query: "OpenAI agents",
      feedIds: ["OpenAI", "anthropic"],
      sourceType: "Blog",
      topics: ["agents", "ml"],
      verified: false,
      sort: "source",
      readerView: "archived",
      cursor: 7,
      limit: 100,
    });

    expect(parseInitialState(params([["verified", "true"]])).verified).toBe(true);
  });
});

describe("reader route parse source", () => {
  it("keeps the current parser exports and defaults without sampling randomness", () => {
    expect(source).not.toContain("Math.random");
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).toContain('return rawMode === "catalog" ? "catalog" : "reader"');
    expect(source).toContain('return "latest"');
    expect(source).toContain("return 0;");
    expect(source).toContain("return 24;");
    expect(source).toContain("return Math.trunc(parsed);");
    expect(source).toContain("return Math.max(1, Math.min(100, Math.trunc(parsed)));");
    expect(source).toContain('query: normalizeSearchQuery(searchParams.get("q")) ?? ""');
    expect(source).toContain(
      'topics: parseSearchTopicsParam(searchParams.getAll("topics").join(","))',
    );

    for (const name of EXPORTED_FUNCTIONS) {
      expect(source).toContain(`export function ${name}`);
    }
  });
});
