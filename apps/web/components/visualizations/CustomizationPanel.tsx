/**
 * Customization panel for chart appearance.
 *
 * Implements T026: Customize colors, axes, labels, legend position
 */

"use client";

import { useState } from "react";

export interface ChartCustomization {
  title?: string;
  titleFontSize?: number;
  showLegend?: boolean;
  legendPosition?: "top" | "bottom" | "left" | "right";
  gridLines?: boolean;
  colors?: string[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  stacked?: boolean;
  showTooltips?: boolean;
}

interface CustomizationPanelProps {
  customization: ChartCustomization;
  onChange: (customization: ChartCustomization) => void;
  chartType: string;
}

const COLOR_PRESETS = [
  {
    name: "Default Blue",
    colors: ["#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"],
  },
  {
    name: "Warm",
    colors: ["#f59e0b", "#ef4444", "#ec4899", "#8b5cf6"],
  },
  {
    name: "Cool",
    colors: ["#10b981", "#14b8a6", "#06b6d4", "#0ea5e9"],
  },
  {
    name: "Monochrome",
    colors: ["#1f2937", "#4b5563", "#6b7280", "#9ca3af"],
  },
  {
    name: "Colorblind Safe",
    colors: ["#0173b2", "#de8f05", "#029e73", "#cc78bc"],
  },
];

export function CustomizationPanel({
  customization,
  onChange,
  chartType,
}: CustomizationPanelProps) {
  const [activeTab, setActiveTab] = useState<"appearance" | "layout" | "colors">("appearance");

  const updateCustomization = (updates: Partial<ChartCustomization>) => {
    onChange({ ...customization, ...updates });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Customize Chart
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Adjust appearance and styling
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("appearance")}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === "appearance"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          Appearance
        </button>
        <button
          onClick={() => setActiveTab("layout")}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === "layout"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          Layout
        </button>
        <button
          onClick={() => setActiveTab("colors")}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === "colors"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          Colors
        </button>
      </div>

      {/* Tab content */}
      <div className="pt-2">
        {activeTab === "appearance" && (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Chart Title
              </label>
              <input
                type="text"
                value={customization.title ?? ""}
                onChange={(e) => updateCustomization({ title: e.target.value })}
                placeholder="Enter chart title..."
                maxLength={100}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {(customization.title?.length ?? 0)}/100 characters
              </p>
            </div>

            {/* Title font size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title Font Size: {customization.titleFontSize ?? 16}px
              </label>
              <input
                type="range"
                min="12"
                max="32"
                value={customization.titleFontSize ?? 16}
                onChange={(e) =>
                  updateCustomization({ titleFontSize: parseInt(e.target.value) })
                }
                className="w-full"
              />
            </div>

            {/* X-axis label */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                X-Axis Label
              </label>
              <input
                type="text"
                value={customization.xAxisLabel ?? ""}
                onChange={(e) => updateCustomization({ xAxisLabel: e.target.value })}
                placeholder="e.g., Date, Category..."
                maxLength={50}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Y-axis label */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Y-Axis Label
              </label>
              <input
                type="text"
                value={customization.yAxisLabel ?? ""}
                onChange={(e) => updateCustomization({ yAxisLabel: e.target.value })}
                placeholder="e.g., Count, Value..."
                maxLength={50}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Show tooltips */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="showTooltips"
                checked={customization.showTooltips ?? true}
                onChange={(e) => updateCustomization({ showTooltips: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label
                htmlFor="showTooltips"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Show tooltips on hover
              </label>
            </div>

            {/* Grid lines */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="gridLines"
                checked={customization.gridLines ?? true}
                onChange={(e) => updateCustomization({ gridLines: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label
                htmlFor="gridLines"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Show grid lines
              </label>
            </div>
          </div>
        )}

        {activeTab === "layout" && (
          <div className="space-y-4">
            {/* Show legend */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="showLegend"
                checked={customization.showLegend ?? true}
                onChange={(e) => updateCustomization({ showLegend: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label
                htmlFor="showLegend"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Show legend
              </label>
            </div>

            {/* Legend position */}
            {customization.showLegend !== false && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Legend Position
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["top", "bottom", "left", "right"] as const).map((position) => (
                    <button
                      key={position}
                      onClick={() => updateCustomization({ legendPosition: position })}
                      className={`px-4 py-2 rounded-lg border transition-all capitalize ${
                        (customization.legendPosition ?? "top") === position
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      {position}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stacked (for bar/area charts) */}
            {(chartType === "bar" || chartType === "area") && (
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="stacked"
                  checked={customization.stacked ?? false}
                  onChange={(e) => updateCustomization({ stacked: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label
                  htmlFor="stacked"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Stack series
                </label>
              </div>
            )}
          </div>
        )}

        {activeTab === "colors" && (
          <div className="space-y-4">
            {/* Color presets */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Color Presets
              </label>
              <div className="space-y-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => updateCustomization({ colors: preset.colors })}
                    className={`w-full p-3 rounded-lg border transition-all text-left ${
                      JSON.stringify(customization.colors) === JSON.stringify(preset.colors)
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {preset.name}
                      </span>
                      <div className="flex gap-1">
                        {preset.colors.map((color, index) => (
                          <div
                            key={index}
                            className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom colors hint */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                💡 <strong>Tip:</strong> Color palettes are optimized for accessibility and print quality.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Reset button */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() =>
            onChange({
              showLegend: true,
              legendPosition: "top",
              gridLines: true,
              showTooltips: true,
            })
          }
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
