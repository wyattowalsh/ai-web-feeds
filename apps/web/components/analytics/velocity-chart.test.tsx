import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("chart.js", () => ({
  Chart: { register: () => undefined },
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  Title: {},
  Tooltip: {},
  Legend: {},
  Filler: {},
}));

vi.mock("react-chartjs-2", () => ({
  Line: ({
    data,
  }: {
    data: {
      labels?: string[];
      datasets?: Array<{ data?: number[] }>;
    };
  }) => (
    <div
      data-testid="velocity-line"
      data-labels={(data.labels ?? []).join("|")}
      data-counts={(data.datasets?.[0]?.data ?? []).join("|")}
    />
  ),
}));

vi.mock("@/lib/theme-manager", () => ({
  useTheme: () => ({ isDark: false }),
}));

import { VelocityChart } from "./velocity-chart";

const source = readFileSync(join(process.cwd(), "components/analytics/velocity-chart.tsx"), "utf8");

const passedPoints = [
  { date: "2026-11-08", count: 7 },
  { date: "2026-11-09", count: 2 },
];

describe("VelocityChart", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the passed dates and counts", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <VelocityChart
        data_points={passedPoints}
        avg_per_feed={2.5}
        most_active_feed={{ id: "alpha", title: "Passed Alpha", count: 3 }}
        least_active_feed={{ id: "beta", title: "Passed Beta", count: 1 }}
      />,
    );

    const region = screen.getByRole("region", { name: "Publication velocity" });
    const line = screen.getByTestId("velocity-line");

    expect(region).toHaveAttribute("data-demo", "false");
    expect(region).toContainElement(screen.getByText("2026-11-08"));
    expect(region).toContainElement(screen.getByText("2026-11-09"));
    expect(region).toContainElement(screen.getByText("7"));
    expect(region).toContainElement(screen.getByText("2"));
    expect(region).toContainElement(screen.getByText("Passed Alpha"));
    expect(region).toContainElement(screen.getByText("Passed Beta"));
    expect(region).toContainElement(screen.getByText("2.5"));
    expect(line).toHaveAttribute("data-labels", "2026-11-08|2026-11-09");
    expect(line).toHaveAttribute("data-counts", "7|2");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Invented Feed")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders the empty state inside the chart when there are no points", () => {
    const { unmount } = render(<VelocityChart data_points={[]} />);
    const emptyRegion = screen.getByRole("region", { name: "Publication velocity" });
    const emptyState = screen.getByRole("status");

    expect(emptyRegion).toContainElement(emptyState);
    expect(emptyState).toHaveAttribute("data-state", "empty");
    expect(emptyState).toHaveTextContent("No data");
    expect(emptyState).toHaveTextContent("This chart is empty.");
    expect(screen.queryByTestId("velocity-line")).not.toBeInTheDocument();
    expect(screen.queryByText("2026-11-08")).not.toBeInTheDocument();
    expect(screen.queryByText("Passed Alpha")).not.toBeInTheDocument();

    unmount();
    render(<VelocityChart />);

    expect(screen.getByRole("region", { name: "Publication velocity" })).toContainElement(
      screen.getByRole("status"),
    );
  });

  it("renders the error inside the chart", () => {
    render(
      <VelocityChart
        data_points={passedPoints}
        error="Velocity unavailable"
        most_active_feed={{ id: "alpha", title: "Passed Alpha", count: 3 }}
      />,
    );

    const region = screen.getByRole("region", { name: "Publication velocity" });
    const alert = screen.getByRole("alert");

    expect(region).toContainElement(alert);
    expect(alert).toHaveAttribute("data-state", "error");
    expect(alert).toHaveTextContent("Chart error");
    expect(alert).toHaveTextContent("Velocity unavailable");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByTestId("velocity-line")).not.toBeInTheDocument();
    expect(screen.queryByText("2026-11-08")).not.toBeInTheDocument();
    expect(region).toContainElement(screen.getByText("Passed Alpha"));
  });

  it("exports VelocityChart and does not fetch or synthesize a series", () => {
    expect(source).toContain("export function VelocityChart");
    expect(source).toContain("data_points");
    expect(source).toContain("avg_per_feed");
    expect(source).toContain("most_active_feed");
    expect(source).toContain("least_active_feed");
    expect(source).toContain("error");
    expect(source).toContain("empty");
    expect(source).toContain("demo: false");
    expect(source.includes("fetch" + "(")).toBe(false);
    expect(source.includes("Math" + ".random")).toBe(false);
    expect(source.includes("demo" + ": true")).toBe(false);
    expect(source.toLowerCase().includes("forecast")).toBe(false);
    expect(source).not.toContain("2026-11-08");
    expect(source).not.toContain("Passed Alpha");
    expect(source).not.toContain("/api/analytics/velocity");
  });
});
