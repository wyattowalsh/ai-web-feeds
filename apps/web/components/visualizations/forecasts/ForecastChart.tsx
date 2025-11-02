/**
 * Forecast chart component with confidence intervals.
 *
 * Implements Phase 6 (US4): Forecast visualization
 */

"use client";

import { LineChart } from "../charts/LineChart";
import type { ChartData, ChartOptions } from "chart.js";

export interface ForecastDataPoint {
  date: string;
  value: number;
  lower: number;
  upper: number;
  trend?: number;
  seasonal?: number;
}

interface ForecastChartProps {
  historical: Array<{ date: string; value: number }>;
  forecast: ForecastDataPoint[];
  title?: string;
  height?: number;
  showConfidenceBands?: boolean;
  showComponents?: boolean;
}

export function ForecastChart({
  historical,
  forecast,
  title = "Forecast",
  height = 400,
  showConfidenceBands = true,
  showComponents = false,
}: ForecastChartProps) {
  // Combine historical and forecast data
  const allDates = [
    ...historical.map((h) => h.date),
    ...forecast.map((f) => f.date),
  ];

  // Prepare datasets
  const datasets: any[] = [
    {
      label: "Historical",
      data: historical.map((h) => h.value),
      borderColor: "rgb(59, 130, 246)",
      backgroundColor: "rgba(59, 130, 246, 0.1)",
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
    },
    {
      label: "Forecast",
      data: [
        ...new Array(historical.length - 1).fill(null),
        historical[historical.length - 1]?.value,
        ...forecast.map((f) => f.value),
      ],
      borderColor: "rgb(168, 85, 247)",
      backgroundColor: "rgba(168, 85, 247, 0.1)",
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      fill: false,
    },
  ];

  // Add confidence bands
  if (showConfidenceBands) {
    datasets.push({
      label: "Upper Bound",
      data: [
        ...new Array(historical.length).fill(null),
        ...forecast.map((f) => f.upper),
      ],
      borderColor: "rgba(168, 85, 247, 0.3)",
      backgroundColor: "rgba(168, 85, 247, 0.1)",
      borderWidth: 1,
      pointRadius: 0,
      fill: "+1",
    });

    datasets.push({
      label: "Lower Bound",
      data: [
        ...new Array(historical.length).fill(null),
        ...forecast.map((f) => f.lower),
      ],
      borderColor: "rgba(168, 85, 247, 0.3)",
      backgroundColor: "rgba(168, 85, 247, 0.1)",
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
    });
  }

  // Add trend component
  if (showComponents && forecast[0]?.trend !== undefined) {
    datasets.push({
      label: "Trend",
      data: [
        ...new Array(historical.length).fill(null),
        ...forecast.map((f) => f.trend),
      ],
      borderColor: "rgb(34, 197, 94)",
      borderWidth: 2,
      borderDash: [2, 2],
      pointRadius: 0,
      fill: false,
    });
  }

  const chartData: ChartData<"line"> = {
    labels: allDates,
    datasets,
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      title: {
        display: !!title,
        text: title,
        font: { size: 16 },
      },
      legend: {
        position: "top",
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || "";
            const value = context.parsed.y;
            if (value === null) return "";
            return `${label}: ${value.toFixed(2)}`;
          },
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
        beginAtZero: false,
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
      },
    },
  };

  return (
    <div>
      <LineChart data={chartData} options={options} height={height} />

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-blue-500" />
          <span className="text-gray-700 dark:text-gray-300">Historical</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-purple-500 border-dashed border-t-2 border-purple-500" />
          <span className="text-gray-700 dark:text-gray-300">Forecast</span>
        </div>
        {showConfidenceBands && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-purple-200 dark:bg-purple-900" />
            <span className="text-gray-700 dark:text-gray-300">
              Confidence Interval
            </span>
          </div>
        )}
        {showComponents && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-green-500 border-dashed border-t-2 border-green-500" />
            <span className="text-gray-700 dark:text-gray-300">Trend</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Forecast metrics display.
 */
export function ForecastMetrics({ metrics }: { metrics: Record<string, number> }) {
  const metricLabels: Record<string, string> = {
    mae: "Mean Absolute Error",
    rmse: "Root Mean Squared Error",
    mape: "Mean Absolute Percentage Error",
    r2: "R² Score",
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Object.entries(metrics).map(([key, value]) => (
        <div
          key={key}
          className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {metricLabels[key] || key.toUpperCase()}
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {key === "r2" ? value.toFixed(3) : value.toFixed(2)}
          </div>
          {key === "mape" && <div className="text-xs text-gray-500 mt-1">%</div>}
        </div>
      ))}
    </div>
  );
}
