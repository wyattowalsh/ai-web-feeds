import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { escapeRegExp, tokenizeQuery } from "./tokenize";

const source = readFileSync(join(process.cwd(), "lib/search/tokenize.ts"), "utf8");

describe("tokenizeQuery", () => {
  it("returns an empty list for empty and whitespace-only input", () => {
    expect(tokenizeQuery("")).toEqual([]);
    expect(tokenizeQuery("   ")).toEqual([]);
    expect(tokenizeQuery(" \t\n ")).toEqual([]);
    expect(tokenizeQuery("\n\t")).toEqual([]);
  });

  it("splits unquoted words on whitespace and lowercases them", () => {
    expect(tokenizeQuery("LLM Agents")).toEqual(["llm", "agents"]);
    expect(tokenizeQuery("  LLM \t Agents\n")).toEqual(["llm", "agents"]);
    expect(tokenizeQuery("a    b")).toEqual(["a", "b"]);
    expect(tokenizeQuery("GPT-4 2024")).toEqual(["gpt-4", "2024"]);
    expect(tokenizeQuery("Café")).toEqual(["café"]);
    expect(tokenizeQuery("ai ai")).toEqual(["ai", "ai"]);
  });

  it("keeps double-quoted and single-quoted phrases as one lowercase token", () => {
    expect(tokenizeQuery('"tool use" agents')).toEqual(["tool use", "agents"]);
    expect(tokenizeQuery("'fine tuning'")).toEqual(["fine tuning"]);
    expect(tokenizeQuery('"Tool Use" AGENTS')).toEqual(["tool use", "agents"]);
    expect(tokenizeQuery("'Open Source' AI")).toEqual(["open source", "ai"]);
    expect(tokenizeQuery("  'Hello World'  FOO  ")).toEqual(["hello world", "foo"]);
    expect(tokenizeQuery('"it\'s a phrase"')).toEqual(["it's a phrase"]);
    expect(tokenizeQuery("'say \"hi\" now'")).toEqual(['say "hi" now']);
  });

  it("mixes quoted phrases with bare words and keeps token order", () => {
    expect(tokenizeQuery('rag "vector db" python')).toEqual(["rag", "vector db", "python"]);
    expect(tokenizeQuery("a \"b c\" d 'e f' g")).toEqual(["a", "b c", "d", "e f", "g"]);
    expect(tokenizeQuery('"a b""c d"')).toEqual(["a b", "c d"]);
    expect(tokenizeQuery('don\'t "stop"')).toEqual(["don't", "stop"]);
  });

  it("trims quoted edges, keeps internal spaces, and leaves attached punctuation", () => {
    expect(tokenizeQuery('"  tool   use  "')).toEqual(["tool   use"]);
    expect(tokenizeQuery("c++ node.js (llm)")).toEqual(["c++", "node.js", "(llm)"]);
    expect(tokenizeQuery("it's fine")).toEqual(["it's", "fine"]);
  });

  it("drops whitespace-only quotes and treats unpaired quotes as literal text", () => {
    expect(tokenizeQuery('"   "')).toEqual([]);
    expect(tokenizeQuery("'   '")).toEqual([]);
    expect(tokenizeQuery('foo "   " bar')).toEqual(["foo", "bar"]);
    expect(tokenizeQuery('"hello world')).toEqual(['"hello', "world"]);
    expect(tokenizeQuery('hello world"')).toEqual(["hello", 'world"']);
    expect(tokenizeQuery('""')).toEqual(['""']);
    expect(tokenizeQuery('"" foo')).toEqual(['""', "foo"]);
    expect(tokenizeQuery('foo"bar baz"')).toEqual(['foo"bar', 'baz"']);
  });
});

describe("escapeRegExp", () => {
  it("escapes regex metacharacters and leaves plain text unchanged", () => {
    const metacharacters = ".*+?^${}()|[]\\";

    expect(escapeRegExp("a+b?")).toBe("a\\+b\\?");
    expect(escapeRegExp(metacharacters)).toBe("\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\");
    expect(escapeRegExp("a+b? (c)|[d]^e$f{g}h\\i")).toBe(
      "a\\+b\\? \\(c\\)\\|\\[d\\]\\^e\\$f\\{g\\}h\\\\i",
    );
    expect(escapeRegExp("")).toBe("");
    expect(escapeRegExp("plain text")).toBe("plain text");
    expect(escapeRegExp("llm-agents_v2/docs: #1")).toBe("llm-agents_v2/docs: #1");
  });

  it("makes metacharacters match literally inside a RegExp", () => {
    const sample = "a+b? (c)|[d].";
    const pattern = new RegExp(escapeRegExp(sample));

    expect(pattern.test(sample)).toBe(true);
    expect(pattern.test("aaab (c)|[d]x")).toBe(false);
    expect(new RegExp(escapeRegExp(".")).test(".")).toBe(true);
    expect(new RegExp(escapeRegExp(".")).test("a")).toBe(false);
  });
});

describe("tokenize source", () => {
  it("exports only the query helpers and does not fetch or randomize", () => {
    const exported = [...source.matchAll(/^export function (\w+)/gm)].map((match) => match[1]);

    expect(exported).toEqual(["tokenizeQuery", "escapeRegExp"]);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/Math\.random/);
  });
});
