/**
 * Bar chart component using Chart.js.
 *
 * Implements T025: Chart.js wrapper for bar charts
 */

"use client";

import { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface BarChartProps {
  data: ChartData<"bar">;
  options?: ChartOptions<"bar">;
  height?: number;
  horizontal?: boolean;
  className?: string;
}

export function BarChart({
  data,
  options,
  height = 300,
  horizontal = false,
  className = "",
}: BarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS<"bar"> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const defaultOptions: ChartOptions<"bar"> = {
      indexAxis: horizontal ? "y" : "x",
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
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
        },
        y: {
          beginAtZero: true,
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
      type: "bar",
      data,
      options: mergedOptions,
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data, options, horizontal]);

  return (
    <div className={className} style={{ height: `${height}px` }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export function createBarChartData(
  labels: string[],
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
  }>
): ChartData<"bar"> {
  return {
    labels,
    datasets: datasets.map((dataset) => ({
      ...dataset,
      borderWidth: 1,
      backgroundColor: dataset.backgroundColor ?? "rgba(59, 130, 246, 0.6)",
      borderColor: dataset.borderColor ?? "rgb(59, 130, 246)",
    })),
  };
}
