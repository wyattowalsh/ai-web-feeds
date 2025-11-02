/**
 * Line chart component using Chart.js.
 *
 * Implements T025: Chart.js wrapper for line charts
 */

"use client";

import { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
} from "chart.js";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface LineChartProps {
  data: ChartData<"line">;
  options?: ChartOptions<"line">;
  height?: number;
  className?: string;
}

export function LineChart({
  data,
  options,
  height = 300,
  className = "",
}: LineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS<"line"> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Default options
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
          titleFont: {
            size: 14,
            weight: "bold",
          },
          bodyFont: {
            size: 13,
          },
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

    // Merge with custom options
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

    // Create chart
    chartRef.current = new ChartJS(ctx, {
      type: "line",
      data,
      options: mergedOptions,
    });

    // Cleanup
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

/**
 * Helper function to create line chart data.
 */
export function createLineChartData(
  labels: string[],
  datasets: Array<{
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
    tension?: number;
  }>
): ChartData<"line"> {
  return {
    labels,
    datasets: datasets.map((dataset) => ({
      ...dataset,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: dataset.tension ?? 0.3,
      borderColor: dataset.borderColor ?? "rgb(59, 130, 246)",
      backgroundColor: dataset.backgroundColor ?? "rgba(59, 130, 246, 0.1)",
      fill: false,
    })),
  };
}

/**
 * Get publication-quality export options.
 */
export function getExportOptions(dpi: 72 | 150 | 300 = 300): Partial<ChartOptions<"line">> {
  const scaleFactor = dpi / 72; // Base DPI is 72

  return {
    animation: false, // Disable animation for export
    plugins: {
      legend: {
        labels: {
          font: {
            size: 14 * scaleFactor,
          },
        },
      },
      title: {
        font: {
          size: 18 * scaleFactor,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          font: {
            size: 12 * scaleFactor,
          },
        },
      },
      y: {
        ticks: {
          font: {
            size: 12 * scaleFactor,
          },
        },
      },
    },
  };
}
