import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { chartRenders } = vi.hoisted(() => ({
  chartRenders: [] as Array<{
    labels: string[];
    datasets: Array<{ label?: string; data: number[] }>;
  }>,
}));

vi.mock("chart.js", () => {
  class Chart {
    static register(): void {}
  }

  return {
    Chart,
    CategoryScale: {},
    LinearScale: {},
    BarElement: {},
    Title: {},
    Tooltip: {},
    Legend: {},
  };
});

vi.mock("react-chartjs-2", () => ({
  Bar: ({
    data,
  }: {
    data: {
      labels?: string[];
      datasets?: Array<{ label?: string; data?: number[] }>;
    };
  }) => {
    chartRenders.push({
      labels: [...(data.labels ?? [])],
      datasets: (data.datasets ?? []).map((dataset) => ({
        label: dataset.label,
        data: [...(dataset.data ?? [])],
      })),
    });

    return <div data-testid="trending-topics-bars" />;
  },
}));

vi.mock("@/lib/theme-manager", () => ({
  useTheme: () => ({ isDark: false }),
}));

import { TrendingTopicsChart } from "./trending-topics-chart";

const source = readFileSync(
  join(process.cwd(), "components/analytics/trending-topics-chart.tsx"),
  "utf8",
);

const agentsTopic = {
  topic: "agents",
  feed_count: 10,
  validation_frequency: 0.9,
  avg_health_score: 0.88,
};

describe("TrendingTopicsChart", () => {
  beforeEach(() => {
    chartRenders.length = 0;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the empty state inside the component", () => {
    render(<TrendingTopicsChart topics={[]} dateRange="30d" limit={10} />);

    const region = screen.getByRole("region", { name: "Trending topics" });
    expect(region).toHaveAttribute("data-state", "empty");
    expect(region).toHaveAttribute("data-demo", "false");
    expect(screen.getByRole("status")).toHaveTextContent("No data");
    expect(screen.getByRole("status")).toHaveTextContent("This chart is empty.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trending-topics-bars")).not.toBeInTheDocument();
    expect(screen.queryByText(agentsTopic.topic)).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(chartRenders).toHaveLength(0);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("renders the error inside the component and does not draw bars", () => {
    render(<TrendingTopicsChart topics={[agentsTopic]} error="Topic stats unavailable" />);

    const region = screen.getByRole("region", { name: "Trending topics" });
    expect(region).toHaveAttribute("data-state", "error");
    expect(region).toHaveAttribute("data-demo", "false");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Chart error");
    expect(alert).toHaveTextContent("Topic stats unavailable");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trending-topics-bars")).not.toBeInTheDocument();
    expect(screen.queryByText(agentsTopic.topic)).not.toBeInTheDocument();
    expect(screen.queryByText(`${agentsTopic.feed_count} feeds`)).not.toBeInTheDocument();
    expect(chartRenders).toHaveLength(0);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("renders a passed topic label from the topic rows", () => {
    render(<TrendingTopicsChart topics={[agentsTopic]} />);

    const region = screen.getByRole("region", { name: "Trending topics" });
    expect(region).toHaveAttribute("data-state", "ready");
    expect(region).toHaveAttribute("data-demo", "false");
    expect(screen.getByText(agentsTopic.topic)).toBeInTheDocument();
    expect(screen.getByText(`${agentsTopic.feed_count} feeds`)).toBeInTheDocument();
    expect(screen.getByText("88% health")).toBeInTheDocument();
    expect(screen.getByTestId("trending-topics-bars")).toBeInTheDocument();
    expect(chartRenders).toEqual([
      {
        labels: [agentsTopic.topic],
        datasets: [{ label: "Validation Frequency", data: [agentsTopic.validation_frequency] }],
      },
    ]);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("keeps the export and does not fetch or invent topic series", () => {
    expect(source).toContain("export function TrendingTopicsChart");
    expect(source.includes("fetch" + "(")).toBe(false);
    expect(source.includes("Math" + ".random")).toBe(false);
    expect(source).toContain('data-demo="false"');
    expect(source.includes("demo" + ": true")).toBe(false);
    expect(source.toLowerCase().includes("forecast")).toBe(false);
    expect(source).not.toContain("/api/analytics/trending");
    expect(source).not.toContain(agentsTopic.topic);
    expect(source).not.toMatch(/feed_count\s*:\s*\d+/);
  });
});
