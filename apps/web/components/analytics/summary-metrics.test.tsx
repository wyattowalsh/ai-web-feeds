import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SummaryMetrics } from "./summary-metrics";

const source = readFileSync(
  join(process.cwd(), "components/analytics/summary-metrics.tsx"),
  "utf8",
);

const fixture = {
  total_feeds: 1847,
  active_feeds: 1203,
  validation_success_rate: 0.876,
  avg_response_time: 245.4,
  health_distribution: {
    healthy: 900,
    moderate: 203,
    unhealthy: 100,
  },
  last_updated: "2026-01-15T12:00:00.000Z",
};

describe("SummaryMetrics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the empty state inside the component when metrics are absent", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<SummaryMetrics metrics={null} dateRange="30d" topic="llm" />);

    const region = screen.getByRole("region", { name: "Summary metrics" });
    expect(region).toHaveAttribute("data-state", "empty");
    expect(region).toHaveAttribute("data-demo", "false");
    expect(screen.getByRole("status")).toHaveTextContent("No data");
    expect(screen.getByRole("status")).toHaveTextContent("No catalog metrics were provided.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Total feeds")).not.toBeInTheDocument();
    expect(screen.queryByText(fixture.total_feeds.toLocaleString())).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders the error inside the component and does not invent counts", () => {
    render(<SummaryMetrics error="Failed to load catalog metrics" />);

    const region = screen.getByRole("region", { name: "Summary metrics" });
    expect(region).toHaveAttribute("data-state", "error");
    expect(region).toHaveAttribute("data-demo", "false");
    expect(screen.getByRole("alert")).toHaveTextContent("Error loading metrics");
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load catalog metrics");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("Total feeds")).not.toBeInTheDocument();
    expect(screen.queryByText(fixture.total_feeds.toLocaleString())).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders a fixture total only when metrics are passed in", () => {
    const { unmount } = render(<SummaryMetrics />);
    expect(screen.queryByText(fixture.total_feeds.toLocaleString())).not.toBeInTheDocument();
    unmount();

    render(<SummaryMetrics metrics={fixture} dateRange="7d" topic="agents" />);

    const region = screen.getByRole("region", { name: "Summary metrics" });
    expect(region).toHaveAttribute("data-state", "ready");
    expect(region).toHaveAttribute("data-demo", "false");
    expect(screen.getByText("Total feeds")).toBeInTheDocument();
    expect(screen.getByText(fixture.total_feeds.toLocaleString())).toBeInTheDocument();
    expect(screen.getByText(fixture.active_feeds.toLocaleString())).toBeInTheDocument();
    expect(screen.getByText("87.6%")).toBeInTheDocument();
    expect(screen.getByText("245 ms")).toBeInTheDocument();
    expect(screen.getByText(String(fixture.health_distribution.healthy))).toBeInTheDocument();
    expect(screen.getByText(String(fixture.health_distribution.moderate))).toBeInTheDocument();
    expect(screen.getByText(String(fixture.health_distribution.unhealthy))).toBeInTheDocument();
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the export and does not fetch or invent catalog series", () => {
    expect(source).toContain("export function SummaryMetrics");
    expect(source.includes("fetch" + "(")).toBe(false);
    expect(source.includes("Math" + ".random")).toBe(false);
    expect(source).toContain('role="alert"');
    expect(source).toContain('role="status"');
    expect(source).toContain('data-demo="false"');
    expect(source.includes("demo" + ": true")).toBe(false);
    expect(source.toLowerCase().includes("forecast")).toBe(false);
    expect(source.includes("Chart" + "Builder")).toBe(false);
    expect(source).not.toContain("/api/analytics/summary");
    expect(source).not.toMatch(/total_feeds\s*:\s*\d+/);
    expect(source).not.toContain(String(fixture.total_feeds));
  });
});
