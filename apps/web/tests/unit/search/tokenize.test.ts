import { describe, expect, it } from "vitest";

import { escapeRegExp, tokenizeQuery } from "@/lib/search/tokenize";

describe("tokenizeQuery", () => {
  it("returns empty array for blank input", () => {
    expect(tokenizeQuery("")).toEqual([]);
    expect(tokenizeQuery("   ")).toEqual([]);
  });

  it("splits unquoted terms and lowercases", () => {
    expect(tokenizeQuery("LLM Agents")).toEqual(["llm", "agents"]);
  });

  it("preserves quoted phrases as single terms", () => {
    expect(tokenizeQuery('"tool use" agents')).toEqual(["tool use", "agents"]);
    expect(tokenizeQuery("'fine tuning'")).toEqual(["fine tuning"]);
  });

  it("handles mixed quoted and bare tokens", () => {
    expect(tokenizeQuery('rag "vector db" python')).toEqual(["rag", "vector db", "python"]);
  });
});

describe("escapeRegExp", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegExp("a+b?")).toBe("a\\+b\\?");
  });
});
