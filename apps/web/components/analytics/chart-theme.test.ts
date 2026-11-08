import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getAnalyticsChartTheme, type AnalyticsChartTheme } from "./chart-theme";

const source = readFileSync(join(process.cwd(), "components/analytics/chart-theme.ts"), "utf8");

const lightTheme: AnalyticsChartTheme = {
  text: "#222b3b",
  textMuted: "#667086",
  grid: "rgba(102, 112, 134, 0.18)",
  accent: "#4a5fd4",
  accentSoft: "rgba(74, 95, 212, 0.16)",
  success: "#2f9f72",
  successSoft: "rgba(47, 159, 114, 0.14)",
  warning: "#d6a437",
  warningSoft: "rgba(214, 164, 55, 0.16)",
  danger: "#d2615b",
  dangerSoft: "rgba(210, 97, 91, 0.16)",
};

const darkTheme: AnalyticsChartTheme = {
  text: "#f2ede4",
  textMuted: "#c1c7d3",
  grid: "rgba(193, 199, 211, 0.18)",
  accent: "#8b9cf0",
  accentSoft: "rgba(139, 156, 240, 0.18)",
  success: "#4fbd8a",
  successSoft: "rgba(79, 189, 138, 0.16)",
  warning: "#e4bf62",
  warningSoft: "rgba(228, 191, 98, 0.18)",
  danger: "#ef8a84",
  dangerSoft: "rgba(239, 138, 132, 0.18)",
};

describe("getAnalyticsChartTheme", () => {
  it("returns the same keys with the existing light and dark colors", () => {
    const light = getAnalyticsChartTheme(false);
    const dark = getAnalyticsChartTheme(true);
    const keys = Object.keys(lightTheme).sort();

    expect(Object.keys(light).sort()).toEqual(keys);
    expect(Object.keys(dark).sort()).toEqual(keys);
    expect(light).toEqual(lightTheme);
    expect(dark).toEqual(darkTheme);

    for (const key of keys) {
      const themeKey = key as keyof AnalyticsChartTheme;
      expect(lightTheme[themeKey]).not.toBe(darkTheme[themeKey]);
      expect(light[themeKey]).not.toBe(dark[themeKey]);
      expect(source).toContain(light[themeKey]);
      expect(source).toContain(dark[themeKey]);
    }
  });

  it("does not fetch, use Math.random, or read the catalog", () => {
    expect(source).toContain("export interface AnalyticsChartTheme");
    expect(source).toContain("export function getAnalyticsChartTheme");
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/catalog/i);
    expect(source).not.toMatch(/feeds\.yaml/);
    expect(source).not.toMatch(/readFileSync/);
  });
});
