import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { catalogSeries, type CatalogSeriesRow } from "./catalog-series";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "catalog-series.ts"),
  "utf8",
);

function expectRowsFromInput(
  points: readonly CatalogSeriesRow[],
  input: readonly CatalogSeriesRow[],
) {
  expect(points).toHaveLength(input.length);
  points.forEach((point, index) => {
    expect(point).toBe(input[index]);
  });
}

describe("catalogSeries", () => {
  it("returns exactly the empty series for empty input", () => {
    const empty = { demo: false, points: [] };

    expect(catalogSeries()).toEqual(empty);
    expect(catalogSeries(undefined)).toEqual(empty);
    expect(catalogSeries(null)).toEqual(empty);
    expect(catalogSeries([])).toEqual(empty);
    expect(catalogSeries({})).toEqual(empty);
    expect(catalogSeries({ feeds: [], sources: [], points: [], rows: [] })).toEqual(empty);
    expect(catalogSeries({ demo: true })).toEqual(empty);
    expect(catalogSeries({ forecast: [{ label: "Mon", value: 99 }] })).toEqual(empty);
    expect(catalogSeries({ forecasts: [{ label: "Tue", value: 40 }] })).toEqual(empty);
    expect(catalogSeries("")).toEqual(empty);
  });

  it("uses only the catalog rows on the input", () => {
    const rows = [
      {
        id: "src-agents",
        title: "Agents Weekly",
        url: "https://example.com/agents.xml",
        topics: ["agents"],
        date: "2026-01-01",
        value: 4,
      },
      {
        id: "src-models",
        title: "Model Notes",
        url: "https://example.com/models.xml",
        topics: ["models"],
        date: "2026-01-02",
        count: 9,
      },
    ];
    const forecast = [{ id: "future", title: "Forecast", date: "2026-02-01", value: 99 }];
    const series = catalogSeries({ feeds: rows, forecast, demo: true });

    expect(series).toEqual({ demo: false, points: rows });
    expectRowsFromInput(series.points, rows);
    expect(series).not.toHaveProperty("ml");
    expect(series).not.toHaveProperty("forecast");
    expect(JSON.stringify(series.points)).not.toContain("99");
    expect(JSON.stringify(series.points)).not.toContain("Forecast");
    expect(JSON.stringify(series.points)).not.toContain("Mon");
  });

  it("keeps an array of catalog rows without adding points", () => {
    const rows = [
      { id: "src-agents", title: "Agents Weekly", url: "https://example.com/agents.xml" },
    ];
    const series = catalogSeries(rows);

    expect(series.demo).toBe(false);
    expectRowsFromInput(series.points, rows);
    expect(Object.keys(series).sort()).toEqual(["demo", "points"]);
  });

  it("keeps one catalog row and does not explode string topics", () => {
    const row = {
      id: "src-agents",
      title: "Agents Weekly",
      url: "https://example.com/agents.xml",
      topics: ["agents", "ml"],
    };
    const series = catalogSeries(row);

    expect(series).toEqual({ demo: false, points: [row] });
    expect(series.points[0]).toBe(row);
    expect(series.points).toHaveLength(1);
  });

  it("passes ML through only when supplied and still ignores forecasts", () => {
    const rows = [{ id: "topic-agents", label: "Agents", value: 2 }];
    const ml = { model: "optional-extra", score: 0.25 };
    const series = catalogSeries({
      rows,
      ml,
      forecasts: [{ label: "Agents", value: 50, date: "2026-04-01" }],
    });

    expect(series.demo).toBe(false);
    expect(series.ml).toBe(ml);
    expectRowsFromInput(series.points, rows);
    expect(JSON.stringify(series.points)).not.toContain("50");
    expect(Object.keys(series).sort()).toEqual(["demo", "ml", "points"]);
    expect(catalogSeries({ ml })).toEqual({ demo: false, points: [], ml });
  });

  it("does not ship a demo fixture or forbidden visualization imports", () => {
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/from ["']three["']/);
    expect(source).not.toMatch(/ChartBuilder/);
    expect(source).not.toMatch(/device-id/);
    expect(source).not.toMatch(/demo:\s*true/);
    expect(source).not.toMatch(/generateSampleData/);
  });
});
