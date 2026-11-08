import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HealthDistributionChart } from "./health-distribution-chart";

vi.mock("chart.js", () => ({
  Chart: {
    register: () => undefined,
  },
  ArcElement: {},
  Tooltip: {},
  Legend: {},
  Title: {},
}));

vi.mock("react-chartjs-2", async () => {
  const { createElement } = await import("react");

  return {
    Pie: ({
      data,
    }: {
      data: {
        labels?: unknown[];
        datasets: Array<{ data: number[] }>;
      };
    }) =>
      createElement("div", {
        "data-testid": "health-pie",
        "data-series": String(data.datasets.length),
        "data-values": JSON.stringify(data.datasets.map((dataset) => dataset.data)),
        "data-labels": JSON.stringify(data.labels ?? []),
      }),
  };
});

vi.mock("@/lib/theme-manager", () => ({
  useTheme: () => ({ isDark: false }),
}));

const source = readFileSync(
  join(process.cwd(), "components/analytics/health-distribution-chart.tsx"),
  "utf8",
);

function chartRegion(): HTMLElement {
  return screen.getByRole("region", { name: "Health distribution" });
}

function renderedCount(
  region: HTMLElement,
  band: "healthy" | "moderate" | "unhealthy",
): string | null {
  const text = region.querySelector(`[data-health-count="${band}"]`)?.textContent;
  return text?.trim() ?? null;
}

describe("HealthDistributionChart", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports HealthDistributionChart and does not fetch or use Math.random", () => {
    expect(source).toContain("export function HealthDistributionChart");
    expect(source.includes("fetch" + "(")).toBe(false);
    expect(source.includes("Math" + ".random")).toBe(false);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toContain("/api/analytics/summary");
    expect(source).not.toContain("ChartSkeleton");
    expect(source.toLowerCase()).not.toContain("forecast");
    expect(source).toContain('data-demo="false"');
    expect(source).not.toContain('data-demo="true"');
    expect(source).not.toContain("demo: true");
    expect(source).toContain("empty=");
    expect(source).toContain("error=");
    expect(source).toContain("healthy");
    expect(source).toContain("moderate");
    expect(source).toContain("unhealthy");
  });

  it("renders empty and error inside the component", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<HealthDistributionChart distribution={null} />);

    let region = chartRegion();
    expect(region).toHaveAttribute("data-demo", "false");
    expect(region).toHaveAttribute("data-state", "empty");
    expect(within(region).getByRole("status")).toHaveAttribute("data-state", "empty");
    expect(within(region).getByRole("status")).toHaveTextContent("No data");
    expect(within(region).getByRole("status")).toHaveTextContent("This chart is empty.");
    expect(
      within(region).getByRole("heading", { name: "Health distribution" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByTestId("health-pie")).not.toBeInTheDocument();
    expect(region.querySelector(".animate-pulse")).toBeNull();
    expect(region.textContent).not.toContain("NaN");
    expect(fetchMock).not.toHaveBeenCalled();

    rerender(<HealthDistributionChart />);
    region = chartRegion();
    expect(within(region).getByRole("status")).toHaveTextContent("This chart is empty.");
    expect(screen.queryByTestId("health-pie")).not.toBeInTheDocument();

    rerender(<HealthDistributionChart distribution={{ healthy: 0, moderate: 0, unhealthy: 0 }} />);
    region = chartRegion();
    expect(region).toHaveAttribute("data-state", "empty");
    expect(within(region).getByRole("status")).toBeInTheDocument();
    expect(screen.queryByTestId("health-pie")).not.toBeInTheDocument();
    expect(region.querySelector("[data-health-count]")).toBeNull();
    expect(region.textContent).not.toContain("0.0%");

    rerender(
      <HealthDistributionChart
        distribution={{ healthy: 17, moderate: 23, unhealthy: 41 }}
        error="Distribution unavailable"
      />,
    );
    region = chartRegion();
    expect(region).toContainElement(within(region).getByRole("alert"));
    expect(region).toHaveAttribute("data-state", "error");
    expect(region).toHaveAttribute("data-demo", "false");
    expect(within(region).getByRole("alert")).toHaveTextContent("Chart error");
    expect(within(region).getByRole("alert")).toHaveTextContent("Distribution unavailable");
    expect(
      within(region).getByRole("heading", { name: "Health distribution" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByTestId("health-pie")).not.toBeInTheDocument();
    expect(renderedCount(region, "healthy")).toBeNull();
    expect(renderedCount(region, "moderate")).toBeNull();
    expect(renderedCount(region, "unhealthy")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders the passed healthy, moderate, and unhealthy numbers", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const healthy = 17;
    const moderate = 23;
    const unhealthy = 41;

    const { rerender } = render(
      <HealthDistributionChart distribution={{ healthy, moderate, unhealthy }} />,
    );

    let region = chartRegion();
    const pie = within(region).getByTestId("health-pie");

    expect(region).toHaveAttribute("data-state", "ready");
    expect(region).toHaveAttribute("data-demo", "false");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(pie).toHaveAttribute("data-series", "1");
    expect(pie).toHaveAttribute("data-values", JSON.stringify([[healthy, moderate, unhealthy]]));
    expect(renderedCount(region, "healthy")).toBe(String(healthy));
    expect(renderedCount(region, "moderate")).toBe(String(moderate));
    expect(renderedCount(region, "unhealthy")).toBe(String(unhealthy));
    expect(source).not.toContain(String(healthy));
    expect(source).not.toContain(String(moderate));
    expect(source).not.toContain(String(unhealthy));
    expect(fetchMock).not.toHaveBeenCalled();

    rerender(<HealthDistributionChart distribution={{ healthy: 5, moderate: 0, unhealthy: 2 }} />);
    region = chartRegion();
    expect(within(region).getByTestId("health-pie")).toHaveAttribute(
      "data-values",
      JSON.stringify([[5, 0, 2]]),
    );
    expect(renderedCount(region, "healthy")).toBe("5");
    expect(renderedCount(region, "moderate")).toBe("0");
    expect(renderedCount(region, "unhealthy")).toBe("2");

    rerender(
      <HealthDistributionChart
        distribution={{ healthy: 8, moderate: 1, unhealthy: 1 }}
        error="   "
      />,
    );
    region = chartRegion();
    expect(region).toHaveAttribute("data-state", "ready");
    expect(within(region).getByTestId("health-pie")).toHaveAttribute(
      "data-values",
      JSON.stringify([[8, 1, 1]]),
    );
    expect(renderedCount(region, "healthy")).toBe("8");
    expect(renderedCount(region, "moderate")).toBe("1");
    expect(renderedCount(region, "unhealthy")).toBe("1");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
