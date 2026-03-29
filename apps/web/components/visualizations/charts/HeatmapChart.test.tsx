import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { chartRegisterMock, chartInstances } = vi.hoisted(() => ({
  chartRegisterMock: vi.fn(),
  chartInstances: [] as Array<{
    config: Record<string, unknown>;
    destroy: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("chart.js", () => {
  class MockChart {
    static register = chartRegisterMock;
    chartArea = { width: 240, height: 180 };
    destroy = vi.fn();
    config: Record<string, unknown>;

    constructor(_context: unknown, config: Record<string, unknown>) {
      this.config = config;
      chartInstances.push(this);
    }
  }

  return {
    Chart: MockChart,
    LinearScale: {},
    CategoryScale: {},
    Title: {},
    Tooltip: {},
    Legend: {},
  };
});

vi.mock("chartjs-chart-matrix", () => ({
  MatrixController: {},
  MatrixElement: {},
}));

import { HeatmapChart, createHeatmapData } from "./HeatmapChart";

function createMockCanvasContext(
  ..._args: Parameters<HTMLCanvasElement["getContext"]>
): ReturnType<HTMLCanvasElement["getContext"]> {
  return {} as never;
}

describe("HeatmapChart", () => {
  beforeEach(() => {
    chartInstances.length = 0;
    chartRegisterMock.mockClear();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(createMockCanvasContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a matrix chart with transformed axis labels and legend", () => {
    render(
      <HeatmapChart
        className="heatmap"
        height={320}
        data={[
          { x: "Tue", y: "AM", v: 1.5 },
          { x: "Unknown", y: "PM", v: 2.25 },
        ]}
        xLabels={["Mon", "Tue"]}
        yLabels={["AM", "PM"]}
      />,
    );

    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();

    const canvas = document.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(canvas?.parentElement).toHaveClass("heatmap");
    expect(canvas?.parentElement).toHaveStyle({ height: "320px" });

    const config = chartInstances[0]?.config as {
      type: string;
      data: { datasets: Array<{ data: unknown[] }> };
      options: { scales: { x: { labels: string[] }; y: { labels: string[] } } };
    };

    expect(config.type).toBe("matrix");
    expect(config.options.scales.x.labels).toEqual(["Mon", "Tue"]);
    expect(config.options.scales.y.labels).toEqual(["AM", "PM"]);
    expect(config.data.datasets[0]?.data).toEqual([
      { x: 1, y: 0, v: 1.5, labelX: "Tue", labelY: "AM" },
      { x: 0, y: 1, v: 2.25, labelX: "Unknown", labelY: "PM" },
    ]);
  });

  it("interpolates colors, handles flat values, and formats tooltip labels safely", () => {
    const firstRender = render(
      <HeatmapChart
        colorScale={{ min: "#000000", max: "#ffffff" }}
        data={[
          { x: "Mon", y: "AM", v: 0 },
          { x: "Tue", y: "AM", v: 5 },
          { x: "Wed", y: "AM", v: 10 },
        ]}
        xLabels={["Mon", "Tue", "Wed"]}
        yLabels={["AM"]}
      />,
    );

    const config = chartInstances[0]?.config as {
      data: {
        datasets: Array<{
          data: Array<Record<string, unknown>>;
          backgroundColor: (context: { raw: unknown }) => string;
        }>;
      };
      options: {
        plugins: {
          tooltip: {
            callbacks: {
              label: (context: { raw: unknown }) => string;
            };
          };
        };
      };
    };

    const dataset = config.data.datasets[0];
    expect(dataset.backgroundColor({ raw: dataset.data[0] })).toBe("rgb(0, 0, 0)");
    expect(dataset.backgroundColor({ raw: dataset.data[1] })).toBe("rgb(128, 128, 128)");
    expect(dataset.backgroundColor({ raw: dataset.data[2] })).toBe("rgb(255, 255, 255)");

    const tooltipLabel = config.options.plugins.tooltip.callbacks.label;
    expect(tooltipLabel({ raw: dataset.data[1] })).toBe("Tue × AM: 5.00");
    expect(tooltipLabel({ raw: null })).toBe("? × ?: 0.00");

    firstRender.unmount();
    vi.restoreAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(createMockCanvasContext);
    chartInstances.length = 0;

    render(
      <HeatmapChart
        colorScale={{ min: "#112233", max: "#abcdef" }}
        data={[{ x: "Mon", y: "AM", v: 7 }]}
        xLabels={["Mon"]}
        yLabels={["AM"]}
      />,
    );

    const flatConfig = chartInstances[0]?.config as {
      data: {
        datasets: Array<{
          data: Array<Record<string, unknown>>;
          backgroundColor: (context: { raw: unknown }) => string;
        }>;
      };
    };

    const flatDataset = flatConfig.data.datasets[0];
    expect(flatDataset.backgroundColor({ raw: flatDataset.data[0] })).toBe("rgb(17, 34, 51)");
  });

  it("returns zero matrix cell dimensions for empty axes and destroys charts on rerender/unmount", () => {
    const { rerender, unmount } = render(
      <HeatmapChart
        data={[{ x: "Mon", y: "AM", v: 1 }]}
        xLabels={["Mon"]}
        yLabels={["AM"]}
      />,
    );

    const firstChart = chartInstances[0];
    expect(firstChart).toBeDefined();

    rerender(<HeatmapChart data={[]} xLabels={[]} yLabels={[]} />);

    expect(firstChart?.destroy).toHaveBeenCalled();

    const secondConfig = chartInstances[1]?.config as {
      data: {
        datasets: Array<{
          width: (context: { chart: { chartArea?: { width: number } } }) => number;
          height: (context: { chart: { chartArea?: { height: number } } }) => number;
        }>;
      };
    };

    const secondDataset = secondConfig.data.datasets[0];
    expect(secondDataset.width({ chart: { chartArea: { width: 200 } } })).toBe(0);
    expect(secondDataset.height({ chart: { chartArea: { height: 100 } } })).toBe(0);

    unmount();
    expect(chartInstances[1]?.destroy).toHaveBeenCalledTimes(1);
  });

  it("builds heatmap data in row-major order and defaults missing cells to zero", () => {
    expect(
      createHeatmapData(
        ["Mon", "Tue"],
        ["AM", "PM"],
        [[1, 2]],
      ),
    ).toEqual([
      { x: "Mon", y: "AM", v: 1 },
      { x: "Tue", y: "AM", v: 2 },
      { x: "Mon", y: "PM", v: 0 },
      { x: "Tue", y: "PM", v: 0 },
    ]);
  });
});
