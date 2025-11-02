/**
 * Enhanced visualization detail view.
 *
 * Implements T032: View, edit, export, and delete saved visualizations
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChartContainer } from "@/components/visualizations/ChartContainer";
import { LineChart } from "@/components/visualizations/charts/LineChart";
import { BarChart } from "@/components/visualizations/charts/BarChart";
import { ScatterChart } from "@/components/visualizations/charts/ScatterChart";
import { PieChart } from "@/components/visualizations/charts/PieChart";
import { AreaChart } from "@/components/visualizations/charts/AreaChart";
import { HeatmapChart } from "@/components/visualizations/charts/HeatmapChart";
import { exportChart, type ExportFormat } from "@/lib/visualization/chart-export";
import { getDeviceId } from "@/lib/visualization/device-id";
import {
  getVisualization,
  updateVisualization,
  deleteVisualization,
  getVisualizationData,
} from "@/lib/visualization/api-client";

interface VisualizationDetailPageProps {
  params: {
    id: string;
  };
}

export default function VisualizationDetailPage({
  params,
}: VisualizationDetailPageProps) {
  const router = useRouter();
  const chartRef = useRef<HTMLDivElement>(null);

  const [visualization, setVisualization] = useState<any>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadVisualization();
  }, [params.id]);

  const loadVisualization = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const deviceId = getDeviceId();

      // Fetch visualization config
      const viz = await getVisualization(params.id, deviceId);
      setVisualization(viz);

      // Fetch visualization data
      const data = await getVisualizationData(params.id, deviceId);
      setChartData(data);
    } catch (err) {
      console.error("Failed to load visualization:", err);
      setError(err instanceof Error ? err.message : "Failed to load visualization");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format: ExportFormat, dpi: 72 | 150 | 300 = 300) => {
    if (!chartRef.current) return;

    setIsExporting(true);

    try {
      const canvas = chartRef.current.querySelector("canvas");
      if (!canvas) {
        throw new Error("Chart canvas not found");
      }

      const deviceId = getDeviceId();

      await exportChart(
        canvas,
        {
          dataSource: visualization.data_source,
          chartType: visualization.chart_type,
          dateRange: visualization.filters.date_range,
          datePreset: visualization.filters.date_preset,
          customization: visualization.customization,
        },
        {
          format,
          dpi,
          includeMetadata: true,
          title: visualization.name,
        },
        deviceId
      );
    } catch (err) {
      console.error("Export failed:", err);
      alert(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const deviceId = getDeviceId();
      await deleteVisualization(params.id, deviceId);
      router.push("/analytics/visualizations");
    } catch (err) {
      console.error("Delete failed:", err);
      alert(`Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setIsDeleting(false);
    }
  };

  const handleEdit = () => {
    // Navigate to edit page (to be implemented)
    router.push(`/analytics/visualizations/${params.id}/edit`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading visualization...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-8">
        <div className="max-w-md w-full p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Error Loading Visualization
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => router.push("/analytics/visualizations")}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Back to Visualizations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push("/analytics/visualizations")}
              className="text-blue-600 dark:text-blue-400 hover:underline mb-2 flex items-center gap-2"
            >
              ← Back to Visualizations
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {visualization.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {visualization.chart_type} • {visualization.data_source} •{" "}
              Created {new Date(visualization.created_at).toLocaleDateString()}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Edit
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Chart display */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div ref={chartRef}>
            <ChartContainer isLoading={false} error={null} isEmpty={!chartData}>
              {renderChart(
                visualization.chart_type,
                chartData,
                visualization.customization
              )}
            </ChartContainer>
          </div>
        </div>

        {/* Export panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Export Chart
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* PNG Export */}
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                PNG Image
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                High-quality raster image for presentations
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => handleExport("png", 72)}
                  disabled={isExporting}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm disabled:opacity-50"
                >
                  72 DPI (Screen)
                </button>
                <button
                  onClick={() => handleExport("png", 150)}
                  disabled={isExporting}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm disabled:opacity-50"
                >
                  150 DPI (Web)
                </button>
                <button
                  onClick={() => handleExport("png", 300)}
                  disabled={isExporting}
                  className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm disabled:opacity-50"
                >
                  300 DPI (Print)
                </button>
              </div>
            </div>

            {/* SVG Export */}
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                SVG Vector
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Scalable vector graphics for editing
              </p>
              <button
                onClick={() => handleExport("svg")}
                disabled={isExporting}
                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50"
              >
                Download SVG
              </button>
            </div>

            {/* HTML Export */}
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                HTML Page
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Standalone interactive page with metadata
              </p>
              <button
                onClick={() => handleExport("html")}
                disabled={isExporting}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition disabled:opacity-50"
              >
                Download HTML
              </button>
            </div>
          </div>

          {isExporting && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Exporting chart... Please wait.
              </p>
            </div>
          )}
        </div>

        {/* Metadata panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Metadata
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Chart Type
              </p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">
                {visualization.chart_type}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Data Source
              </p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">
                {visualization.data_source}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Date Range
              </p>
              <p className="text-gray-900 dark:text-gray-100 text-sm">
                {new Date(visualization.filters.date_range.start).toLocaleDateString()} -{" "}
                {new Date(visualization.filters.date_range.end).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Created
              </p>
              <p className="text-gray-900 dark:text-gray-100 text-sm">
                {new Date(visualization.created_at).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Last Viewed
              </p>
              <p className="text-gray-900 dark:text-gray-100 text-sm">
                {new Date(visualization.last_viewed).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Filters Applied
              </p>
              <p className="text-gray-900 dark:text-gray-100 text-sm">
                {Object.keys(visualization.filters).length} filter(s)
              </p>
            </div>
          </div>
        </div>

        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Delete Visualization?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete "{visualization.name}"? This action cannot
                be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Render chart based on type.
 */
function renderChart(type: string, data: any, customization: any): JSX.Element | null {
  if (!data) return null;

  const commonOptions = {
    plugins: {
      title: {
        display: !!customization.title,
        text: customization.title,
      },
      legend: {
        display: customization.show_legend !== false,
        position: customization.legend_position ?? "top",
      },
    },
  };

  switch (type) {
    case "line":
      return <LineChart data={data} options={commonOptions as any} height={500} />;
    case "bar":
      return <BarChart data={data} options={commonOptions as any} height={500} />;
    case "scatter":
      return <ScatterChart data={data} options={commonOptions as any} height={500} />;
    case "pie":
      return <PieChart data={data} height={500} />;
    case "area":
      return <AreaChart data={data} options={commonOptions as any} height={500} />;
    case "heatmap":
      return <HeatmapChart {...data} height={500} />;
    default:
      return null;
  }
}
