import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  normalizeSearchQuery,
  normalizeSearchTopics,
  parseSearchType,
  parseThresholdSearchFilter,
} from "./search";

const source = readFileSync(join(process.cwd(), "lib/search.ts"), "utf8");

const EXPORTED_TYPES = [
  "SearchScope",
  "SearchType",
  "SearchFilterInput",
  "SearchFilters",
  "SearchExecutionState",
  "BaseSearchResult",
  "SourceSearchResult",
  "ArticleSearchResult",
  "SearchResult",
  "SearchResponseMeta",
  "SearchResponsePayload",
] as const;

const EXPORTED_CONSTANTS = [
  "DEFAULT_SEARCH_THRESHOLD",
  "MIN_SEARCH_THRESHOLD",
  "MAX_SEARCH_THRESHOLD",
  "DEFAULT_SEARCH_SCOPE",
  "DEFAULT_UNBOUNDED_SEARCH_META",
] as const;

const EXPORTED_FUNCTIONS = [
  "normalizeSearchQuery",
  "parseSearchType",
  "parseSearchScope",
  "toBackendSearchType",
  "parseVerifiedSearchFilter",
  "normalizeSearchTopics",
  "parseSearchTopicsParam",
  "parseSearchFeedIdsParam",
  "parseThresholdSearchFilter",
  "normalizeSearchFilters",
  "parseSearchStateFromParams",
] as const;

describe("normalizeSearchQuery", () => {
  it("turns a blank catalog query into null", () => {
    expect(normalizeSearchQuery("")).toBeNull();
    expect(normalizeSearchQuery("   ")).toBeNull();
    expect(normalizeSearchQuery("\n\t")).toBeNull();
    expect(normalizeSearchQuery(null)).toBeNull();
    expect(normalizeSearchQuery(undefined)).toBeNull();
  });

  it("trims surrounding space and collapses internal whitespace", () => {
    expect(normalizeSearchQuery("  agents  ")).toBe("agents");
    expect(normalizeSearchQuery("  large   language\nmodels  ")).toBe("large language models");
  });
});

describe("parseSearchType", () => {
  it("accepts articles and sources after trim and lowercase", () => {
    expect(parseSearchType("articles")).toBe("articles");
    expect(parseSearchType("  ARTICLES  ")).toBe("articles");
    expect(parseSearchType("sources")).toBe("sources");
    expect(parseSearchType(" Sources ")).toBe("sources");
  });

  it("defaults a missing or unknown catalog scope to sources", () => {
    expect(parseSearchType(null)).toBe("sources");
    expect(parseSearchType(undefined)).toBe("sources");
    expect(parseSearchType("")).toBe("sources");
    expect(parseSearchType("semantic")).toBe("sources");
    expect(parseSearchType("full_text")).toBe("sources");
  });
});

describe("parseThresholdSearchFilter", () => {
  it("clamps finite thresholds below 0.5 to 0.5 and above 1 to 1", () => {
    expect(parseThresholdSearchFilter(0)).toBe(0.5);
    expect(parseThresholdSearchFilter(0.49)).toBe(0.5);
    expect(parseThresholdSearchFilter(-1)).toBe(0.5);
    expect(parseThresholdSearchFilter("0.2")).toBe(0.5);
    expect(parseThresholdSearchFilter(1.4)).toBe(1);
    expect(parseThresholdSearchFilter("2")).toBe(1);
    expect(parseThresholdSearchFilter(0.5)).toBe(0.5);
    expect(parseThresholdSearchFilter(1)).toBe(1);
    expect(parseThresholdSearchFilter(0.7)).toBe(0.7);
    expect(parseThresholdSearchFilter("0.85")).toBe(0.85);
    expect(parseThresholdSearchFilter(" 0.6 ")).toBe(0.6);
  });

  it("returns the default 0.7 threshold when the value is missing or not finite", () => {
    expect(parseThresholdSearchFilter(null)).toBe(0.7);
    expect(parseThresholdSearchFilter(undefined)).toBe(0.7);
    expect(parseThresholdSearchFilter("")).toBe(0.7);
    expect(parseThresholdSearchFilter("not-a-threshold")).toBe(0.7);
    expect(parseThresholdSearchFilter(Number.NaN)).toBe(0.7);
    expect(parseThresholdSearchFilter(Number.POSITIVE_INFINITY)).toBe(0.7);
    expect(parseThresholdSearchFilter(Number.NEGATIVE_INFINITY)).toBe(0.7);
  });
});

describe("normalizeSearchTopics", () => {
  it("drops blank topics and duplicate catalog topics", () => {
    expect(normalizeSearchTopics(null)).toEqual([]);
    expect(normalizeSearchTopics(undefined)).toEqual([]);
    expect(normalizeSearchTopics([])).toEqual([]);
    expect(normalizeSearchTopics(["", "   ", "agents", "Agents", " ml "])).toEqual([
      "agents",
      "ml",
    ]);
    expect(
      normalizeSearchTopics(["  Large   Language Models  ", "large language models", "agents"]),
    ).toEqual(["large language models", "agents"]);
  });
});

describe("search catalog query source", () => {
  it("keeps the existing exports and does not fetch or sample a query", () => {
    expect(source).not.toContain("Math.random");
    expect(source).not.toMatch(/\bfetch\s*\(/);

    for (const name of EXPORTED_TYPES) {
      expect(source).toContain(`export type ${name}`);
    }

    for (const name of EXPORTED_CONSTANTS) {
      expect(source).toContain(`export const ${name}`);
    }

    for (const name of EXPORTED_FUNCTIONS) {
      expect(source).toContain(`export function ${name}`);
    }
  });
});
