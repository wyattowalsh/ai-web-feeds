/**
 * Heatmap chart component using Chart.js Matrix controller.
 *
 * Implements T025: Chart.js wrapper for heatmaps
 */

"use client";

import { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
  ScriptableContext,
  ChartOptions,
  TooltipItem,
} from "chart.js";
import { MatrixController, MatrixElement } from "chartjs-chart-matrix";

ChartJS.register(
  MatrixController,
  MatrixElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend
);

interface HeatmapDataPoint {
  x: string | number;
  y: string | number;
  v: number; // value (intensity)
}

interface HeatmapChartProps {
  data: HeatmapDataPoint[];
  xLabels: string[];
  yLabels: string[];
  options?: ChartOptions<"matrix">;
  height?: number;
  colorScale?: {
    min: string;
    max: string;
  };
  className?: string;
}

type RenderedHeatmapPoint = {
  x: number;
  y: number;
  v: number;
  labelX: string | number;
  labelY: string | number;
};

function resolveAxisValue(value: string | number, labels: string[]): number {
  if (typeof value === "number") {
    return value;
  }

  const index = labels.indexOf(value);
  return index >= 0 ? index : 0;
}

function toRenderedHeatmapPoint(
  point: HeatmapDataPoint,
  xLabels: string[],
  yLabels: string[],
): RenderedHeatmapPoint {
  return {
    x: resolveAxisValue(point.x, xLabels),
    y: resolveAxisValue(point.y, yLabels),
    v: point.v,
    labelX: point.x,
    labelY: point.y,
  };
}

function isRenderedHeatmapPoint(value: unknown): value is RenderedHeatmapPoint {
  if (!value || typeof value !== "object") {
    return false;
  }

  const point = value as Partial<RenderedHeatmapPoint>;
  const validAxisValue = typeof point.x === "number";
  const validRowValue = typeof point.y === "number";

  return (
    validAxisValue &&
    validRowValue &&
    typeof point.v === "number" &&
    (typeof point.labelX === "string" || typeof point.labelX === "number") &&
    (typeof point.labelY === "string" || typeof point.labelY === "number")
  );
}

export function HeatmapChart({
  data,
  xLabels,
  yLabels,
  options,
  height = 400,
  colorScale = { min: "#e3f2fd", max: "#1565c0" },
  className = "",
}: HeatmapChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS<"matrix"> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Find min/max values for color scaling
    const values = data.map((d) => d.v);
    const hasValues = values.length > 0;
    const minValue = hasValues ? Math.min(...values) : 0;
    const maxValue = hasValues ? Math.max(...values) : 0;
    const valueRange = maxValue - minValue;
    const matrixData = data.map((point) => toRenderedHeatmapPoint(point, xLabels, yLabels));

    const defaultOptions: ChartOptions<"matrix"> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            title: () => "",
            label: (context: TooltipItem<"matrix">) => {
              const point = isRenderedHeatmapPoint(context.raw)
                ? context.raw
                : { x: 0, y: 0, v: 0, labelX: "?", labelY: "?" };
              return `${point.labelX} × ${point.labelY}: ${point.v.toFixed(2)}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "category",
          labels: xLabels,
          ticks: {
            display: true,
          },
          grid: {
            display: false,
          },
        },
        y: {
          type: "category",
          labels: yLabels,
          offset: true,
          ticks: {
            display: true,
          },
          grid: {
            display: false,
          },
        },
      },
    };

    const mergedOptions: ChartOptions<"matrix"> = {
      ...defaultOptions,
      ...options,
    };

    chartRef.current = new ChartJS(ctx, {
      type: "matrix",
      data: {
        datasets: [
          {
            label: "Heatmap",
            data: matrixData,
            backgroundColor: (context: ScriptableContext<"matrix">) => {
              const point = isRenderedHeatmapPoint(context.raw) ? context.raw : null;
              const value = point?.v ?? 0;
              const normalized = valueRange > 0 ? (value - minValue) / valueRange : 0;
              return interpolateColor(colorScale.min, colorScale.max, normalized);
            },
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.5)",
            width: ({ chart }: ScriptableContext<"matrix">) =>
              xLabels.length > 0 ? (chart.chartArea?.width || 0) / xLabels.length - 1 : 0,
            height: ({ chart }: ScriptableContext<"matrix">) =>
              yLabels.length > 0 ? (chart.chartArea?.height || 0) / yLabels.length - 1 : 0,
          },
        ],
      },
      options: mergedOptions,
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data, xLabels, yLabels, options, colorScale]);

  return (
    <div className={className} style={{ height: `${height}px` }}>
      <canvas ref={canvasRef} />
      {/* Color scale legend */}
      <div className="flex items-center justify-center gap-2 mt-2">
        <span className="text-xs text-gray-600 dark:text-gray-400">Low</span>
        <div
          className="h-4 w-32 rounded"
          style={{
            background: `linear-gradient(to right, ${colorScale.min}, ${colorScale.max})`,
          }}
        />
        <span className="text-xs text-gray-600 dark:text-gray-400">High</span>
      </div>
    </div>
  );
}

/**
 * Interpolate between two hex colors.
 */
function interpolateColor(color1: string, color2: string, factor: number): string {
  // Parse hex colors
  const c1 = color1.match(/\w\w/g)?.map((x) => parseInt(x, 16)) ?? [0, 0, 0];
  const c2 = color2.match(/\w\w/g)?.map((x) => parseInt(x, 16)) ?? [0, 0, 0];

  // Interpolate
  const r = Math.round(c1[0] + factor * (c2[0] - c1[0]));
  const g = Math.round(c1[1] + factor * (c2[1] - c1[1]));
  const b = Math.round(c1[2] + factor * (c2[2] - c1[2]));

  return `rgb(${r}, ${g}, ${b})`;
}

export function createHeatmapData(
  xLabels: string[],
  yLabels: string[],
  matrix: number[][]
): HeatmapDataPoint[] {
  const data: HeatmapDataPoint[] = [];

  for (let y = 0; y < yLabels.length; y++) {
    for (let x = 0; x < xLabels.length; x++) {
      data.push({
        x: xLabels[x],
        y: yLabels[y],
        v: matrix[y]?.[x] ?? 0,
      });
    }
  }

  return data;
}
