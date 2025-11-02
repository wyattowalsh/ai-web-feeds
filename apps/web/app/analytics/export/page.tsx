/**
 * Data Export page.
 *
 * Implements Phase 8 (US6): Bulk data export with multiple formats
 */

"use client";

import { useState } from "react";
import { getDeviceId } from "@/lib/visualization/device-id";

interface ExportTable {
  name: string;
  description: string;
  columns: string[];
  selected: boolean;
}

const AVAILABLE_TABLES: ExportTable[] = [
  {
    name: "topic_metrics",
    description: "Topic mention frequency and trends",
    columns: ["topic_id", "date", "mention_count", "sentiment_score"],
    selected: false,
  },
  {
    name: "feed_health",
    description: "Feed health and response metrics",
    columns: ["feed_id", "timestamp", "status", "response_time_ms", "error"],
    selected: false,
  },
  {
    name: "article_metadata",
    description: "Article publication data",
    columns: ["article_id", "feed_id", "title", "published_at", "author"],
    selected: false,
  },
  {
    name: "validation_logs",
    description: "Feed validation results",
    columns: ["feed_id", "timestamp", "is_valid", "error_count", "warning_count"],
    selected: false,
  },
];

type ExportFormat = "json" | "csv" | "parquet";

export default function ExportPage() {
  const [tables, setTables] = useState<ExportTable[]>(AVAILABLE_TABLES);
  const [format, setFormat] = useState<ExportFormat>("json");
  const [isExporting, setIsExporting] = useState(false);

  const toggleTable = (tableName: string) => {
    setTables((prev) =>
      prev.map((table) =>
        table.name === tableName ? { ...table, selected: !table.selected } : table
      )
    );
  };

  const selectedTables = tables.filter((t) => t.selected);
  const canExport = selectedTables.length > 0 && selectedTables.length <= 10;

  const handleExport = async () => {
    if (!canExport) return;

    setIsExporting(true);

    try {
      const deviceId = getDeviceId();

      // Simulate export process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log("Exporting:", {
        tables: selectedTables.map((t) => t.name),
        format,
        deviceId,
      });

      // In production, would trigger actual export and download
      alert(`Export started! ${selectedTables.length} table(s) in ${format.toUpperCase()} format.`);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Data Export
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Export analytics data in multiple formats
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Table selection */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Select Tables to Export
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Choose up to 10 tables for bulk export
              </p>

              <div className="space-y-4">
                {tables.map((table) => (
                  <div
                    key={table.name}
                    onClick={() => toggleTable(table.name)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                      table.selected
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={table.selected}
                        onChange={() => {}}
                        className="mt-1 w-5 h-5 text-blue-600 rounded"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                          {table.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {table.description}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {table.columns.map((col) => (
                            <span
                              key={col}
                              className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded"
                            >
                              {col}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Export configuration */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sticky top-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Export Settings
              </h2>

              {/* Format selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Export Format
                </label>
                <div className="space-y-2">
                  {(["json", "csv", "parquet"] as ExportFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setFormat(fmt)}
                      className={`w-full p-3 rounded-lg border-2 text-left transition ${
                        format === fmt
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700"
                      }`}
                    >
                      <div className="font-semibold text-gray-900 dark:text-gray-100 uppercase">
                        {fmt}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {fmt === "json" && "Structured data, easy to parse"}
                        {fmt === "csv" && "Spreadsheet compatible"}
                        {fmt === "parquet" && "Columnar, efficient for big data"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected tables summary */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Selected Tables
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {selectedTables.length}
                  <span className="text-sm text-gray-500 dark:text-gray-500 ml-1">
                    / 10
                  </span>
                </div>
                {selectedTables.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedTables.map((t) => (
                      <span
                        key={t.name}
                        className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded"
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Export button */}
              <button
                onClick={handleExport}
                disabled={!canExport || isExporting}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? "Exporting..." : "Export Data"}
              </button>

              {!canExport && selectedTables.length === 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 text-center">
                  Select at least one table
                </p>
              )}

              {selectedTables.length > 10 && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-2 text-center">
                  Maximum 10 tables allowed
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Export info */}
        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
            Export Features
          </h3>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>• <strong>Multiple formats</strong>: JSON, CSV, Parquet</li>
            <li>• <strong>Bulk export</strong>: Up to 10 tables at once</li>
            <li>• <strong>Pagination</strong>: Automatic handling of large datasets</li>
            <li>• <strong>Streaming</strong>: Efficient for very large tables</li>
            <li>• <strong>Rate limiting</strong>: 100 requests per hour</li>
          </ul>
        </div>

        {/* Format comparison */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Format Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="p-3 text-left">Format</th>
                  <th className="p-3 text-left">Best For</th>
                  <th className="p-3 text-left">Size</th>
                  <th className="p-3 text-left">Speed</th>
                  <th className="p-3 text-left">Compatibility</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="p-3 font-medium">JSON</td>
                  <td className="p-3">APIs, web apps, human-readable</td>
                  <td className="p-3 text-amber-600">Medium</td>
                  <td className="p-3 text-green-600">Fast</td>
                  <td className="p-3 text-green-600">Excellent</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="p-3 font-medium">CSV</td>
                  <td className="p-3">Excel, spreadsheets, simple analysis</td>
                  <td className="p-3 text-green-600">Small</td>
                  <td className="p-3 text-green-600">Fast</td>
                  <td className="p-3 text-green-600">Universal</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="p-3 font-medium">Parquet</td>
                  <td className="p-3">Big data, analytics, data warehouses</td>
                  <td className="p-3 text-green-600">Very Small</td>
                  <td className="p-3 text-amber-600">Medium</td>
                  <td className="p-3 text-amber-600">Specialized</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
