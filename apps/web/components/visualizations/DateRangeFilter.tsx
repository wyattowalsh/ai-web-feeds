/**
 * Date range filter component.
 *
 * Implements T027: Date range filter with presets and custom picker
 */

"use client";

import { useState } from "react";

export type DateRangePreset = "7d" | "30d" | "90d" | "365d" | "custom" | "all";

export interface DateRange {
  start: string;
  end: string;
}

interface DateRangeFilterProps {
  selected: DateRange | null;
  onSelect: (range: DateRange, preset: DateRangePreset) => void;
  disabled?: boolean;
}

const PRESETS: Array<{
  id: DateRangePreset;
  label: string;
  description: string;
}> = [
  {
    id: "7d",
    label: "Last 7 Days",
    description: "Past week",
  },
  {
    id: "30d",
    label: "Last 30 Days",
    description: "Past month",
  },
  {
    id: "90d",
    label: "Last 90 Days",
    description: "Past quarter",
  },
  {
    id: "365d",
    label: "Last Year",
    description: "Past 12 months",
  },
  {
    id: "all",
    label: "All Time",
    description: "Complete history",
  },
  {
    id: "custom",
    label: "Custom Range",
    description: "Pick specific dates",
  },
];

export function DateRangeFilter({
  selected,
  onSelect,
  disabled = false,
}: DateRangeFilterProps) {
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [activePreset, setActivePreset] = useState<DateRangePreset | null>(null);

  const handlePresetClick = (preset: DateRangePreset) => {
    if (preset === "custom") {
      setShowCustomPicker(true);
      setActivePreset("custom");
      return;
    }

    setShowCustomPicker(false);
    setActivePreset(preset);

    // Calculate date range
    const end = new Date();
    const start = new Date();

    switch (preset) {
      case "7d":
        start.setDate(end.getDate() - 7);
        break;
      case "30d":
        start.setDate(end.getDate() - 30);
        break;
      case "90d":
        start.setDate(end.getDate() - 90);
        break;
      case "365d":
        start.setDate(end.getDate() - 365);
        break;
      case "all":
        start.setFullYear(2020, 0, 1); // Arbitrary start date
        break;
    }

    onSelect(
      {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
      },
      preset
    );
  };

  const handleCustomApply = () => {
    if (!customStart || !customEnd) {
      return;
    }

    // Validate dates
    const start = new Date(customStart);
    const end = new Date(customEnd);

    if (start > end) {
      alert("Start date must be before end date");
      return;
    }

    if (end > new Date()) {
      alert("End date cannot be in the future");
      return;
    }

    onSelect(
      {
        start: customStart,
        end: customEnd,
      },
      "custom"
    );

    setShowCustomPicker(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Date Range
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Filter data by time period
        </p>
      </div>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const isActive = activePreset === preset.id;

          return (
            <button
              key={preset.id}
              onClick={() => handlePresetClick(preset.id)}
              disabled={disabled}
              className={`
                px-4 py-2 rounded-lg border transition-all font-medium text-sm
                ${
                  isActive
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Custom date picker */}
      {showCustomPicker && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                min={customStart}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCustomApply}
              disabled={!customStart || !customEnd}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply Custom Range
            </button>
            <button
              onClick={() => setShowCustomPicker(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Selected range display */}
      {selected && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm text-green-800 dark:text-green-200">
              <span className="font-medium">Selected range:</span>{" "}
              <span className="font-mono">
                {new Date(selected.start).toLocaleDateString()} -{" "}
                {new Date(selected.end).toLocaleDateString()}
              </span>
              {" "}
              <span className="text-green-600 dark:text-green-400">
                ({Math.ceil((new Date(selected.end).getTime() - new Date(selected.start).getTime()) / (1000 * 60 * 60 * 24))} days)
              </span>
            </div>
            <button
              onClick={() => {
                setActivePreset(null);
                onSelect({ start: "", end: "" }, "all");
              }}
              className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm font-medium"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Timezone notice */}
      <div className="text-xs text-gray-500 dark:text-gray-500">
        Times shown in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone})
      </div>
    </div>
  );
}

/**
 * Calculate date range from preset.
 */
export function getDateRangeFromPreset(preset: DateRangePreset): DateRange {
  const end = new Date();
  const start = new Date();

  switch (preset) {
    case "7d":
      start.setDate(end.getDate() - 7);
      break;
    case "30d":
      start.setDate(end.getDate() - 30);
      break;
    case "90d":
      start.setDate(end.getDate() - 90);
      break;
    case "365d":
      start.setDate(end.getDate() - 365);
      break;
    case "all":
      start.setFullYear(2020, 0, 1);
      break;
    default:
      // Return empty for custom
      return { start: "", end: "" };
  }

  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}
