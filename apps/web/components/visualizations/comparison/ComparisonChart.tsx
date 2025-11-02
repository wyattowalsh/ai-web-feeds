/**
 * Comparison chart components.
 *
 * Implements Phase 7 (US5): Comparative analytics
 */

"use client";

import { LineChart, createLineChartData } from "../charts/LineChart";
import { BarChart, createBarChartData } from "../charts/BarChart";
import type { ChartData } from "chart.js";

export interface ComparisonDataset {
  id: string;
  label: string;
  data: number[];
  color?: string;
}

interface MultiSeriesComparisonProps {
  labels: string[];
  datasets: ComparisonDataset[];
  title?: string;
  chartType?: "line" | "bar";
  height?: number;
}

/**
 * Multi-series comparison chart.
 */
export function MultiSeriesComparison({
  labels,
  datasets,
  title,
  chartType = "line",
  height = 400,
}: MultiSeriesComparisonProps) {
  const colors = [
    "#3b82f6", // blue
    "#ef4444", // red
    "#10b981", // green
    "#f59e0b", // amber
    "#8b5cf6", // purple
    "#ec4899", // pink
  ];

  const formattedDatasets = datasets.map((ds, index) => ({
    label: ds.label,
    data: ds.data,
    borderColor: ds.color ?? colors[index % colors.length],
    backgroundColor: ds.color ?? colors[index % colors.length],
  }));

  if (chartType === "line") {
    const chartData = createLineChartData(labels, formattedDatasets);
    return (
      <div>
        {title && (
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {title}
          </h3>
        )}
        <LineChart data={chartData} height={height} />
      </div>
    );
  } else {
    const chartData = createBarChartData(labels, formattedDatasets);
    return (
      <div>
        {title && (
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {title}
          </h3>
        )}
        <BarChart data={chartData} height={height} />
      </div>
    );
  }
}

/**
 * Side-by-side comparison cards.
 */
export function ComparisonCards({
  items,
}: {
  items: Array<{
    label: string;
    value: number;
    change?: number;
    unit?: string;
  }>;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item, index) => (
        <div
          key={index}
          className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {item.label}
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {item.value.toLocaleString()}
            {item.unit && (
              <span className="text-sm text-gray-500 dark:text-gray-500 ml-1">
                {item.unit}
              </span>
            )}
          </div>
          {item.change !== undefined && (
            <div
              className={`text-sm mt-1 ${
                item.change >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {item.change >= 0 ? "+" : ""}
              {item.change.toFixed(1)}%
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Correlation matrix heatmap.
 */
export function CorrelationMatrix({
  variables,
  correlations,
}: {
  variables: string[];
  correlations: number[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="p-2"></th>
            {variables.map((v) => (
              <th key={v} className="p-2 text-center font-medium">
                {v}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {variables.map((v, i) => (
            <tr key={v}>
              <td className="p-2 font-medium">{v}</td>
              {correlations[i].map((corr, j) => (
                <td
                  key={j}
                  className="p-2 text-center"
                  style={{
                    backgroundColor: `rgba(59, 130, 246, ${Math.abs(corr)})`,
                    color: Math.abs(corr) > 0.5 ? "white" : "inherit",
                  }}
                >
                  {corr.toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Trend comparison table.
 */
export function TrendComparisonTable({
  items,
}: {
  items: Array<{
    name: string;
    current: number;
    previous: number;
    trend: "up" | "down" | "stable";
  }>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="p-3 text-left">Item</th>
            <th className="p-3 text-right">Current</th>
            <th className="p-3 text-right">Previous</th>
            <th className="p-3 text-right">Change</th>
            <th className="p-3 text-center">Trend</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const change = ((item.current - item.previous) / item.previous) * 100;

            return (
              <tr
                key={index}
                className="border-b border-gray-200 dark:border-gray-700"
              >
                <td className="p-3 font-medium">{item.name}</td>
                <td className="p-3 text-right">{item.current.toLocaleString()}</td>
                <td className="p-3 text-right">{item.previous.toLocaleString()}</td>
                <td
                  className={`p-3 text-right ${
                    change >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {change >= 0 ? "+" : ""}
                  {change.toFixed(1)}%
                </td>
                <td className="p-3 text-center">
                  {item.trend === "up" && (
                    <span className="text-green-600 dark:text-green-400">↑</span>
                  )}
                  {item.trend === "down" && (
                    <span className="text-red-600 dark:text-red-400">↓</span>
                  )}
                  {item.trend === "stable" && (
                    <span className="text-gray-600 dark:text-gray-400">→</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
