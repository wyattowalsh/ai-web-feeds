/**
 * Area chart component using Chart.js.
 *
 * Implements T025: Chart.js wrapper for area charts
 */

"use client";

import { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend
);

interface AreaChartProps {
  data: ChartData<"line">;
  options?: ChartOptions<"line">;
  height?: number;
  stacked?: boolean;
  className?: string;
}

export function AreaChart({
  data,
  options,
  height = 300,
  stacked = false,
  className = "",
}: AreaChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS<"line"> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const defaultOptions: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          position: "top",
        },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          padding: 12,
          cornerRadius: 8,
        },
        filler: {
          propagate: false,
        },
      },
      scales: {
        x: {
          stacked: stacked,
          grid: {
            display: false,
          },
        },
        y: {
          stacked: stacked,
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
      scales: {
        ...defaultOptions.scales,
        ...options?.scales,
      },
    };

    chartRef.current = new ChartJS(ctx, {
      type: "line",
      data,
      options: mergedOptions,
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data, options, stacked]);

  return (
    <div className={className} style={{ height: `${height}px` }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export function createAreaChartData(
  labels: string[],
  datasets: Array<{
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
  }>
): ChartData<"line"> {
  return {
    labels,
    datasets: datasets.map((dataset, index) => ({
      ...dataset,
      fill: true, // This makes it an area chart
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.4,
      borderColor: dataset.borderColor ?? `rgb(${59 + index * 40}, ${130 - index * 20}, ${246 - index * 30})`,
      backgroundColor: dataset.backgroundColor ?? `rgba(${59 + index * 40}, ${130 - index * 20}, ${246 - index * 30}, 0.2)`,
    })),
  };
}
