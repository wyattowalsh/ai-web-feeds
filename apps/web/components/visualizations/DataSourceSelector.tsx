/**
 * Data source selector component.
 *
 * Implements T023: Select data source (feeds, topics, articles, entities, sentiment, quality)
 */

"use client";

import { useState } from "react";

export type DataSource = "feeds" | "topics" | "articles" | "entities" | "sentiment" | "quality";

interface DataSourceOption {
  id: DataSource;
  label: string;
  description: string;
  icon: string;
  available: boolean;
}

const DATA_SOURCES: DataSourceOption[] = [
  {
    id: "topics",
    label: "Topics",
    description: "Topic mention frequency and trends over time",
    icon: "🏷️",
    available: true,
  },
  {
    id: "feeds",
    label: "Feeds",
    description: "Feed health metrics, response times, and success rates",
    icon: "📡",
    available: true,
  },
  {
    id: "articles",
    label: "Articles",
    description: "Article metadata, publication dates, and counts",
    icon: "📄",
    available: true,
  },
  {
    id: "entities",
    label: "Entities",
    description: "Named entity extraction and mentions",
    icon: "🔖",
    available: false, // Phase 5 feature
  },
  {
    id: "sentiment",
    label: "Sentiment",
    description: "Sentiment analysis scores and trends",
    icon: "😊",
    available: false, // Phase 5 feature
  },
  {
    id: "quality",
    label: "Quality Scores",
    description: "Content quality metrics and indicators",
    icon: "⭐",
    available: true,
  },
];

interface DataSourceSelectorProps {
  selected: DataSource | null;
  onSelect: (source: DataSource) => void;
  disabled?: boolean;
}

export function DataSourceSelector({
  selected,
  onSelect,
  disabled = false,
}: DataSourceSelectorProps) {
  const [hoveredSource, setHoveredSource] = useState<DataSource | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Data Source
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Choose the type of data you want to visualize
          </p>
        </div>
        {selected && (
          <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm rounded-full">
            Selected: {DATA_SOURCES.find((s) => s.id === selected)?.label}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DATA_SOURCES.map((source) => {
          const isSelected = selected === source.id;
          const isHovered = hoveredSource === source.id;
          const isDisabled = disabled || !source.available;

          return (
            <button
              key={source.id}
              onClick={() => {
                if (!isDisabled) {
                  onSelect(source.id);
                }
              }}
              onMouseEnter={() => setHoveredSource(source.id)}
              onMouseLeave={() => setHoveredSource(null)}
              disabled={isDisabled}
              className={`
                relative p-4 rounded-lg border-2 text-left transition-all
                ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : isDisabled
                      ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-50 cursor-not-allowed"
                      : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                }
                ${isHovered && !isDisabled && !isSelected ? "shadow-md" : ""}
              `}
            >
              {/* Checkmark for selected */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
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

              {/* "Coming Soon" badge */}
              {!source.available && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                  Coming Soon
                </div>
              )}

              {/* Icon */}
              <div className="text-3xl mb-3">{source.icon}</div>

              {/* Label */}
              <h4
                className={`font-semibold mb-2 ${
                  isSelected
                    ? "text-blue-700 dark:text-blue-300"
                    : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {source.label}
              </h4>

              {/* Description */}
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {source.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Help text */}
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="text-blue-500 text-xl">💡</span>
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              Tip: Choosing the Right Data Source
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>
                • <strong>Topics</strong> - Best for tracking trends and mentions over time
              </li>
              <li>
                • <strong>Feeds</strong> - Ideal for monitoring feed health and reliability
              </li>
              <li>
                • <strong>Articles</strong> - Perfect for publication patterns and volume analysis
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Get data source display info.
 */
export function getDataSourceInfo(source: DataSource): DataSourceOption | undefined {
  return DATA_SOURCES.find((s) => s.id === source);
}
