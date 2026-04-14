import { beforeEach, describe, expect, it, vi } from "vitest";

const { chartRegisterMock } = vi.hoisted(() => ({
  chartRegisterMock: vi.fn(),
}));

vi.mock("chart.js", () => {
  class MockChart {}

  Object.assign(MockChart, {
    register: chartRegisterMock,
  });

  return {
    Chart: MockChart,
    ArcElement: { id: "arc" },
    BarController: { id: "bar-controller" },
    BarElement: { id: "bar-element" },
    CategoryScale: { id: "category" },
    Filler: { id: "filler" },
    Legend: { id: "legend" },
    LineController: { id: "line-controller" },
    LineElement: { id: "line-element" },
    LinearScale: { id: "linear" },
    PieController: { id: "pie-controller" },
    PointElement: { id: "point" },
    Title: { id: "title" },
    Tooltip: { id: "tooltip" },
  };
});

vi.mock("chartjs-chart-matrix", () => ({
  MatrixController: { id: "matrix-controller" },
  MatrixElement: { id: "matrix-element" },
}));

describe("ensureChartJsRegistered", () => {
  beforeEach(() => {
    vi.resetModules();
    chartRegisterMock.mockClear();
  });

  it("registers shared controllers once, including line and bar controllers", async () => {
    const { ensureChartJsRegistered } = await import("./chartjs-registry");

    ensureChartJsRegistered();
    ensureChartJsRegistered();

    expect(chartRegisterMock).toHaveBeenCalledTimes(1);
    const registeredComponents = chartRegisterMock.mock.calls[0] ?? [];
    expect(registeredComponents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "line-controller" }),
        expect.objectContaining({ id: "bar-controller" }),
        expect.objectContaining({ id: "matrix-controller" }),
      ]),
    );
  });
});
