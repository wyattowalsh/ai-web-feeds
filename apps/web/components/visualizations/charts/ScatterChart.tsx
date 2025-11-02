/**
 * Scatter plot component using Chart.js.
 *
 * Implements T025: Chart.js wrapper for scatter plots
 */

"use client";

import { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
} from "chart.js";

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface ScatterChartProps {
  data: ChartData<"scatter">;
  options?: ChartOptions<"scatter">;
  height?: number;
  className?: string;
}

export function ScatterChart({
  data,
  options,
  height = 300,
  className = "",
}: ScatterChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS<"scatter"> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const defaultOptions: ChartOptions<"scatter"> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
        },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const point = context.parsed;
              return `${context.dataset.label}: (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          position: "bottom",
          grid: {
            color: "rgba(0, 0, 0, 0.05)",
          },
        },
        y: {
          type: "linear",
          grid: {
            color: "rgba(0, 0, 0, 0.05)",
          },
        },
      },
    };

    const mergedOptions = {
      ...defaultOptions,
      ...options,
      plugins: {
        ...defaultOptions.plugins,
        ...options?.plugins,
      },
    };

    chartRef.current = new ChartJS(ctx, {
      type: "scatter",
      data,
      options: mergedOptions,
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data, options]);

  return (
    <div className={className} style={{ height: `${height}px` }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export function createScatterChartData(
  datasets: Array<{
    label: string;
    data: Array<{ x: number; y: number }>;
    backgroundColor?: string;
    borderColor?: string;
  }>
): ChartData<"scatter"> {
  return {
    datasets: datasets.map((dataset) => ({
      ...dataset,
      pointRadius: 4,
      pointHoverRadius: 6,
      backgroundColor: dataset.backgroundColor ?? "rgba(59, 130, 246, 0.6)",
      borderColor: dataset.borderColor ?? "rgb(59, 130, 246)",
    })),
  };
}
