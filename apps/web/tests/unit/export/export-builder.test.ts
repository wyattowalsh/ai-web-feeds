import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { articles, closeDB, initializeDB } from "@/lib/db";
import { exportArticlesCsv, exportJson } from "@/lib/exports/export-service";
import { importBundle, parseImportJson } from "@/lib/exports/import-service";

const sampleArticle = {
  id: "a1",
  feedId: "f1",
  title: "Sample",
  link: "https://example.com/a1",
  content: "Body",
  pubDate: Date.now(),
  topics: ["ai"],
  rawCategories: [],
  sourceTopics: ["ai"],
  enclosures: [],
  read: false,
  starred: true,
  archived: false,
  tags: [],
  cachedAt: Date.now(),
  lastModified: Date.now(),
};

describe("export/import services", () => {
  beforeEach(async () => {
    closeDB();
    await initializeDB();
    await articles.put(sampleArticle);
  });

  afterEach(() => {
    closeDB();
  });

  it("exports JSON bundle with articles", async () => {
    const raw = await exportJson();
    const bundle = parseImportJson(raw);
    expect(bundle.articles).toHaveLength(1);
    expect(bundle.articles[0]?.title).toBe("Sample");
  });

  it("exports CSV with header row", async () => {
    const csv = await exportArticlesCsv();
    expect(csv.split("\n")[0]).toContain("title");
    expect(csv).toContain("Sample");
  });

  it("round-trips import on fresh store", async () => {
    const raw = await exportJson();
    const bundle = parseImportJson(raw);
    await articles.delete("a1");
    const result = await importBundle(bundle);
    expect(result.articles).toBe(1);
    const restored = await articles.get("a1");
    expect(restored?.starred).toBe(true);
  });
});
