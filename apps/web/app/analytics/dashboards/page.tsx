/**
 * Dashboards list page.
 *
 * Implements Phase 5 (US3): Dashboard management
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDeviceId } from "@/lib/visualization/device-id";

interface Dashboard {
  id: number;
  name: string;
  layout_config: any;
  created_at: string;
  updated_at: string;
  widget_count: number;
}

export default function DashboardsPage() {
  const router = useRouter();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboards();
  }, []);

  const loadDashboards = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const deviceId = getDeviceId();

      // Simulate API call with sample data
      await new Promise((resolve) => setTimeout(resolve, 500));

      const sampleDashboards: Dashboard[] = [
        {
          id: 1,
          name: "Executive Overview",
          layout_config: {},
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          widget_count: 6,
        },
        {
          id: 2,
          name: "Topic Analytics",
          layout_config: {},
          created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          widget_count: 4,
        },
      ];

      setDashboards(sampleDashboards);
    } catch (err) {
      console.error("Failed to load dashboards:", err);
      setError(err instanceof Error ? err.message : "Failed to load dashboards");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading dashboards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Dashboards
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Create custom dashboards with multiple visualizations
            </p>
          </div>

          <button
            onClick={() => router.push("/analytics/dashboards/new")}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            + Create Dashboard
          </button>
        </div>

        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
          <span className="font-semibold">Advanced / Custom:</span> Dashboards are an
          experimental builder for custom layouts. Prefer the standard analytics
          dashboard?{" "}
          <a href="/analytics" className="font-medium underline hover:no-underline">
            Go to Analytics Overview
          </a>
          .
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Dashboards grid */}
        {dashboards.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No Dashboards Yet
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first custom dashboard to organize your visualizations
            </p>
            <button
              onClick={() => router.push("/analytics/dashboards/new")}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              + Create Dashboard
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboards.map((dashboard) => (
              <div
                key={dashboard.id}
                onClick={() => router.push(`/analytics/dashboards/${dashboard.id}`)}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 cursor-pointer hover:shadow-xl transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {dashboard.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {dashboard.widget_count} widget{dashboard.widget_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-3xl">📊</div>
                </div>

                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <span>Created:</span>
                    <span>{new Date(dashboard.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Updated:</span>
                    <span>{new Date(dashboard.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info panel */}
        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
            What are Dashboards?
          </h3>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>• <strong>Organize visualizations</strong> into a single view</li>
            <li>• <strong>Drag and drop</strong> widgets to customize layout</li>
            <li>• <strong>Resize widgets</strong> to emphasize important metrics</li>
            <li>• <strong>Share dashboards</strong> by exporting configuration</li>
            <li>• <strong>Up to 20 widgets</strong> per dashboard</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
