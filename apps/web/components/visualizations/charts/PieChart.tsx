/**
 * Pie chart component using Chart.js.
 *
 * Implements T025: Chart.js wrapper for pie charts
 */

"use client";

import { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
} from "chart.js";

ChartJS.register(ArcElement, Title, Tooltip, Legend);

interface PieChartProps {
  data: ChartData<"pie">;
  options?: ChartOptions<"pie">;
  height?: number;
  doughnut?: boolean;
  className?: string;
}

export function PieChart({
  data,
  options,
  height = 300,
  doughnut = false,
  className = "",
}: PieChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const defaultOptions: ChartOptions<"pie"> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: {
            padding: 15,
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const label = context.label || "";
              const value = context.parsed;
              const total = context.dataset.data.reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value} (${percentage}%)`;
            },
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
      type: doughnut ? "doughnut" : "pie",
      data,
      options: mergedOptions as any,
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data, options, doughnut]);

  return (
    <div className={className} style={{ height: `${height}px` }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ColorBrewer2 qualitative palette (colorblind-safe)
const DEFAULT_COLORS = [
  "rgb(166, 206, 227)",
  "rgb(31, 120, 180)",
  "rgb(178, 223, 138)",
  "rgb(51, 160, 44)",
  "rgb(251, 154, 153)",
  "rgb(227, 26, 28)",
  "rgb(253, 191, 111)",
  "rgb(255, 127, 0)",
  "rgb(202, 178, 214)",
  "rgb(106, 61, 154)",
];

export function createPieChartData(
  labels: string[],
  data: number[],
  colors?: string[]
): ChartData<"pie"> {
  const backgroundColor = colors ?? DEFAULT_COLORS.slice(0, labels.length);

  return {
    labels,
    datasets: [
      {
        data,
        backgroundColor,
        borderColor: backgroundColor.map((color) => color.replace("rgb", "rgba").replace(")", ", 1)")),
        borderWidth: 2,
      },
    ],
  };
}
