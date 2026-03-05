/**
 * Main visualization dashboard page.
 *
 * Implements T022: Main visualization page with data source selector
 */

"use client";

import { useState, useEffect } from "react";
import { ChartContainer } from "@/components/visualizations/ChartContainer";
import { visualizationApi, type Visualization } from "@/lib/visualization/api-client";
import { getDeviceId } from "@/lib/visualization/device-id";

export default function VisualizationsPage() {
  const [deviceId, setDeviceId] = useState<string>("");
  const [visualizations, setVisualizations] = useState<Visualization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Initialize device ID
  useEffect(() => {
    const id = getDeviceId();
    setDeviceId(id);
  }, []);

  // Load visualizations
  useEffect(() => {
    if (!deviceId) return;

    const loadVisualizations = async () => {
      try {
        setIsLoading(true);
        const data = await visualizationApi.list();
        setVisualizations(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Failed to load visualizations")
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadVisualizations();
  }, [deviceId]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Visualizations
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Create interactive charts and explore your feed analytics data.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
        <span className="font-semibold">Advanced / Custom:</span> This builder is for
        experimental analytics workflows. Prefer the standard view?{" "}
        <a href="/analytics" className="font-medium underline hover:no-underline">
          Go to Analytics Overview
        </a>
        .
      </div>

      {/* Device ID Display */}
      {deviceId && (
        <div className="mb-6 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              Device:
            </span>
            <code className="text-blue-700 dark:text-blue-300 font-mono">
              {deviceId.slice(0, 8)}...{deviceId.slice(-4)}
            </code>
            <span className="text-blue-500 text-xs">
              (Visualizations are saved per device)
            </span>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="mb-6 flex gap-4">
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          + Create Visualization
        </button>
        <button
          onClick={() => window.location.href = "/analytics/dashboards"}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium"
        >
          Dashboards
        </button>
        <button
          onClick={() => window.location.href = "/analytics/visualizations/3d-graph"}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
        >
          3D Topic Graph
        </button>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Create Visualization</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Choose a data source and chart type to get started.
            </p>
            {/* Form will go here */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visualizations List */}
      <ChartContainer isLoading={isLoading} error={error}>
        {visualizations.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No visualizations yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Get started by creating your first visualization.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Create Your First Visualization
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visualizations.map((viz) => (
              <div
                key={viz.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition cursor-pointer"
                onClick={() => window.location.href = `/analytics/visualizations/${viz.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {viz.name}
                  </h3>
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded">
                    {viz.chart_type}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Data: {viz.data_source}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                  <span>
                    Created: {new Date(viz.created_at).toLocaleDateString()}
                  </span>
                  <span>•</span>
                  <span>
                    Viewed: {new Date(viz.last_viewed).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartContainer>

      {/* Quick Start Guide */}
      <div className="mt-12 border-t border-gray-200 dark:border-gray-700 pt-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Quick Start
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Create Charts
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Choose from 6 chart types (line, bar, scatter, pie, area, heatmap)
              and customize colors, labels, and axes.
            </p>
          </div>
          <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-3xl mb-3">🎨</div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Customize
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Real-time preview as you adjust settings. Export as PNG (300 DPI),
              SVG, or interactive HTML.
            </p>
          </div>
          <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-3xl mb-3">💾</div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Save & Share
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Visualizations are saved to your device. Export to transfer between
              devices or share with others.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
