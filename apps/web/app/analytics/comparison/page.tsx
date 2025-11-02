/**
 * Comparative Analytics page.
 *
 * Implements Phase 7 (US5): Compare feeds, topics, and trends
 */

"use client";

import { useState } from "react";
import {
  MultiSeriesComparison,
  ComparisonCards,
  CorrelationMatrix,
  TrendComparisonTable,
} from "@/components/visualizations/comparison/ComparisonChart";

export default function ComparisonPage() {
  const [selectedFeeds, setSelectedFeeds] = useState<string[]>(["feed-1", "feed-2"]);
  const [timeRange, setTimeRange] = useState("30d");

  // Sample data
  const labels = Array.from({ length: 30 }, (_, i) =>
    new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]
  );

  const datasets = selectedFeeds.map((feedId, index) => ({
    id: feedId,
    label: `Feed ${index + 1}`,
    data: Array.from({ length: 30 }, () => Math.floor(Math.random() * 100) + 50),
  }));

  const comparisonCards = [
    { label: "Total Articles", value: 1234, change: 12.5, unit: "" },
    { label: "Avg Response Time", value: 245, change: -8.2, unit: "ms" },
    { label: "Success Rate", value: 98.5, change: 2.1, unit: "%" },
    { label: "Unique Topics", value: 156, change: 15.3, unit: "" },
  ];

  const trendData = [
    { name: "AI News", current: 850, previous: 720, trend: "up" as const },
    { name: "Tech Updates", current: 640, previous: 680, trend: "down" as const },
    { name: "Science Daily", current: 420, previous: 415, trend: "stable" as const },
    { name: "Research Papers", current: 380, previous: 290, trend: "up" as const },
  ];

  const variables = ["Articles", "Mentions", "Sentiment", "Quality"];
  const correlations = [
    [1.0, 0.85, 0.62, 0.73],
    [0.85, 1.0, 0.58, 0.67],
    [0.62, 0.58, 1.0, 0.81],
    [0.73, 0.67, 0.81, 1.0],
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Comparative Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Compare feeds, topics, and trends side-by-side
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Feeds to Compare
            </label>
            <select
              multiple
              value={selectedFeeds}
              onChange={(e) =>
                setSelectedFeeds(
                  Array.from(e.target.selectedOptions, (option) => option.value)
                )
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              size={4}
            >
              <option value="feed-1">AI News Feed</option>
              <option value="feed-2">Tech Updates</option>
              <option value="feed-3">Science Daily</option>
              <option value="feed-4">Research Papers</option>
              <option value="feed-5">Industry Reports</option>
            </select>
          </div>

          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Time Range
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="365d">Last Year</option>
            </select>
          </div>
        </div>

        {/* Comparison Cards */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Key Metrics Comparison
          </h2>
          <ComparisonCards items={comparisonCards} />
        </div>

        {/* Time Series Comparison */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <MultiSeriesComparison
            labels={labels}
            datasets={datasets}
            title="Article Volume Comparison"
            chartType="line"
            height={400}
          />
        </div>

        {/* Trend Comparison Table */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Trend Analysis
          </h2>
          <TrendComparisonTable items={trendData} />
        </div>

        {/* Correlation Matrix */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Correlation Matrix
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Correlation coefficients between different metrics (-1 to 1)
          </p>
          <CorrelationMatrix variables={variables} correlations={correlations} />
        </div>

        {/* Statistical Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Statistical Summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Mean Article Count
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                72.5
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Std Deviation
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                15.2
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Min Value
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                42
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Max Value
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                105
              </div>
            </div>
          </div>
        </div>

        {/* Info panel */}
        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
            Comparison Features
          </h3>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>• <strong>Multi-series charts</strong> for side-by-side visualization</li>
            <li>• <strong>Correlation analysis</strong> to identify relationships</li>
            <li>• <strong>Trend indicators</strong> for quick insights</li>
            <li>• <strong>Statistical summaries</strong> for data distribution</li>
            <li>• Compare up to <strong>5 feeds or topics</strong> simultaneously</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
