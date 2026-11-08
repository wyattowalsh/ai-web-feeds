import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnalyticsFilters } from "./analytics-filters";

const filtersSource = readFileSync(
  join(process.cwd(), "components/analytics/analytics-filters.tsx"),
  "utf8",
);

function renderFilters(overrides: Partial<ComponentProps<typeof AnalyticsFilters>> = {}) {
  const onDateRangeChange = vi.fn();
  const onTopicChange = vi.fn();
  const onRefresh = vi.fn();
  const onExport = vi.fn();

  render(
    <AnalyticsFilters
      dateRange="30d"
      onDateRangeChange={onDateRangeChange}
      onTopicChange={onTopicChange}
      onRefresh={onRefresh}
      onExport={onExport}
      {...overrides}
    />,
  );

  return { onDateRangeChange, onTopicChange, onRefresh, onExport };
}

describe("AnalyticsFilters", () => {
  it("sends the selected time range through onDateRangeChange", () => {
    const { onDateRangeChange } = renderFilters();
    const range = screen.getByLabelText("Time range");

    expect(range).toHaveValue("30d");
    expect(range).toHaveTextContent("Last 7 days");
    expect(range).toHaveTextContent("Last 90 days");

    fireEvent.change(range, { target: { value: "7d" } });

    expect(onDateRangeChange).toHaveBeenCalledTimes(1);
    expect(onDateRangeChange).toHaveBeenCalledWith("7d");
  });

  it("renders empty and error copy inside the filter bar", () => {
    const { onDateRangeChange } = renderFilters({
      emptyMessage: "Nothing matched this slice.",
      errorMessage: "The analytics slice failed.",
    });

    expect(screen.getByRole("alert")).toHaveTextContent("The analytics slice failed.");
    expect(screen.getByRole("status")).toHaveTextContent("Nothing matched this slice.");

    fireEvent.change(screen.getByLabelText("Time range"), { target: { value: "90d" } });
    expect(onDateRangeChange).toHaveBeenCalledWith("90d");
  });

  it("stays presentational and does not invent catalog counts", () => {
    expect(filtersSource).toContain("export function AnalyticsFilters");
    expect(filtersSource.includes("fetch" + "(")).toBe(false);
    expect(filtersSource.includes("Math" + ".random")).toBe(false);
    expect(filtersSource).not.toContain("total_feeds");
    expect(filtersSource).not.toContain("feed_count");
    expect(filtersSource).toContain('role="alert"');
    expect(filtersSource).toContain('role="status"');
  });
});
