/**
 * Chart type selector component.
 *
 * Implements T024: Select chart type (line, bar, scatter, pie, area, heatmap)
 */

"use client";

import { useState } from "react";

export type ChartType = "line" | "bar" | "scatter" | "pie" | "area" | "heatmap";

interface ChartTypeOption {
  id: ChartType;
  label: string;
  description: string;
  icon: JSX.Element;
  bestFor: string[];
  dataRequirements: string;
}

const CHART_TYPES: ChartTypeOption[] = [
  {
    id: "line",
    label: "Line Chart",
    description: "Show trends over time with connected data points",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
        />
      </svg>
    ),
    bestFor: ["Time series", "Trends", "Continuous data"],
    dataRequirements: "Numeric values with time/sequence",
  },
  {
    id: "bar",
    label: "Bar Chart",
    description: "Compare values across categories with vertical bars",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
    bestFor: ["Comparisons", "Rankings", "Categories"],
    dataRequirements: "Categorical data with numeric values",
  },
  {
    id: "scatter",
    label: "Scatter Plot",
    description: "Explore relationships between two numeric variables",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="6" cy="6" r="2" fill="currentColor" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <circle cx="18" cy="8" r="2" fill="currentColor" />
        <circle cx="8" cy="16" r="2" fill="currentColor" />
        <circle cx="16" cy="14" r="2" fill="currentColor" />
      </svg>
    ),
    bestFor: ["Correlations", "Distributions", "Outliers"],
    dataRequirements: "Two numeric variables (X, Y)",
  },
  {
    id: "pie",
    label: "Pie Chart",
    description: "Show proportions and percentages of a whole",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 2v10l7.07 7.07"
        />
      </svg>
    ),
    bestFor: ["Proportions", "Percentages", "Parts of whole"],
    dataRequirements: "Categorical data with totals",
  },
  {
    id: "area",
    label: "Area Chart",
    description: "Display cumulative totals over time with filled regions",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 21h18M3 21V10l6-4 6 4 6-4v11"
          fill="currentColor"
          fillOpacity="0.2"
        />
      </svg>
    ),
    bestFor: ["Volume", "Cumulative data", "Stacked comparisons"],
    dataRequirements: "Time series with volume/total values",
  },
  {
    id: "heatmap",
    label: "Heatmap",
    description: "Visualize patterns in matrix data with color intensity",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="6" height="6" fill="currentColor" opacity="0.3" />
        <rect x="9" y="3" width="6" height="6" fill="currentColor" opacity="0.6" />
        <rect x="15" y="3" width="6" height="6" fill="currentColor" opacity="0.9" />
        <rect x="3" y="9" width="6" height="6" fill="currentColor" opacity="0.7" />
        <rect x="9" y="9" width="6" height="6" fill="currentColor" opacity="0.4" />
        <rect x="15" y="9" width="6" height="6" fill="currentColor" opacity="0.8" />
        <rect x="3" y="15" width="6" height="6" fill="currentColor" opacity="0.5" />
        <rect x="9" y="15" width="6" height="6" fill="currentColor" opacity="0.9" />
        <rect x="15" y="15" width="6" height="6" fill="currentColor" opacity="0.2" />
      </svg>
    ),
    bestFor: ["Patterns", "Density", "Multi-dimensional data"],
    dataRequirements: "Matrix data with numeric intensity values",
  },
];

interface ChartTypeSelectorProps {
  selected: ChartType | null;
  onSelect: (type: ChartType) => void;
  disabled?: boolean;
  dataSource?: string;
}

export function ChartTypeSelector({
  selected,
  onSelect,
  disabled = false,
  dataSource,
}: ChartTypeSelectorProps) {
  const [hoveredType, setHoveredType] = useState<ChartType | null>(null);

  // Get recommended chart types based on data source
  const getRecommendedTypes = (): ChartType[] => {
    if (!dataSource) return [];

    switch (dataSource) {
      case "topics":
        return ["line", "bar", "area"];
      case "feeds":
        return ["line", "bar", "heatmap"];
      case "articles":
        return ["line", "bar", "area"];
      case "quality":
        return ["bar", "scatter", "heatmap"];
      default:
        return [];
    }
  };

  const recommendedTypes = getRecommendedTypes();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Chart Type
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Choose how you want to visualize your data
          </p>
        </div>
        {selected && (
          <div className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-sm rounded-full">
            {CHART_TYPES.find((t) => t.id === selected)?.label}
          </div>
        )}
      </div>

      {/* Recommended types notice */}
      {recommendedTypes.length > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
            <span>⭐</span>
            <span>
              Recommended for <strong>{dataSource}</strong>:{" "}
              {recommendedTypes.map((t) => CHART_TYPES.find((ct) => ct.id === t)?.label).join(", ")}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CHART_TYPES.map((chartType) => {
          const isSelected = selected === chartType.id;
          const isHovered = hoveredType === chartType.id;
          const isRecommended = recommendedTypes.includes(chartType.id);

          return (
            <button
              key={chartType.id}
              onClick={() => {
                if (!disabled) {
                  onSelect(chartType.id);
                }
              }}
              onMouseEnter={() => setHoveredType(chartType.id)}
              onMouseLeave={() => setHoveredType(null)}
              disabled={disabled}
              className={`
                relative p-4 rounded-lg border-2 text-left transition-all
                ${
                  isSelected
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                    : disabled
                      ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-50 cursor-not-allowed"
                      : "border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                }
                ${isHovered && !disabled && !isSelected ? "shadow-md" : ""}
                ${isRecommended && !isSelected ? "ring-2 ring-amber-300 dark:ring-amber-700" : ""}
              `}
            >
              {/* Checkmark for selected */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}

              {/* Recommended badge */}
              {isRecommended && !isSelected && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs rounded font-medium">
                  Recommended
                </div>
              )}

              {/* Icon */}
              <div className={`mb-3 ${isSelected ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-400"}`}>
                {chartType.icon}
              </div>

              {/* Label */}
              <h4
                className={`font-semibold mb-2 ${
                  isSelected
                    ? "text-green-700 dark:text-green-300"
                    : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {chartType.label}
              </h4>

              {/* Description */}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {chartType.description}
              </p>

              {/* Best for */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-500">
                  Best for:
                </p>
                <div className="flex flex-wrap gap-1">
                  {chartType.bestFor.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Data requirements hint */}
      {selected && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
            Data Requirements
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {CHART_TYPES.find((t) => t.id === selected)?.dataRequirements}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Get chart type display info.
 */
export function getChartTypeInfo(type: ChartType): ChartTypeOption | undefined {
  return CHART_TYPES.find((t) => t.id === type);
}
