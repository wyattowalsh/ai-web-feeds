/**
 * Dashboard detail/view page.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardBuilder, type DashboardWidget } from "@/components/visualizations/dashboards/DashboardBuilder";
import { getDeviceId } from "@/lib/visualization/device-id";

interface DashboardDetailPageProps {
  params: {
    id: string;
  };
}

export default function DashboardDetailPage({ params }: DashboardDetailPageProps) {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<any>(null);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, [params.id]);

  const loadDashboard = async () => {
    setIsLoading(true);

    try {
      const deviceId = getDeviceId();

      // Simulate API call with sample data
      await new Promise((resolve) => setTimeout(resolve, 500));

      const sampleDashboard = {
        id: parseInt(params.id),
        name: "Sample Dashboard",
        layout_config: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const sampleWidgets: DashboardWidget[] = [
        {
          id: "widget-1",
          visualization_id: 1,
          type: "chart",
          title: "Topic Trends",
          layout: { i: "widget-1", x: 0, y: 0, w: 6, h: 4 },
          config: {},
        },
        {
          id: "widget-2",
          visualization_id: 2,
          type: "metric",
          title: "Total Articles",
          layout: { i: "widget-2", x: 6, y: 0, w: 3, h: 2 },
          config: {},
        },
        {
          id: "widget-3",
          visualization_id: 3,
          type: "metric",
          title: "Active Feeds",
          layout: { i: "widget-3", x: 9, y: 0, w: 3, h: 2 },
          config: {},
        },
        {
          id: "widget-4",
          visualization_id: 4,
          type: "chart",
          title: "Feed Health",
          layout: { i: "widget-4", x: 6, y: 2, w: 6, h: 4 },
          config: {},
        },
      ];

      setDashboard(sampleDashboard);
      setWidgets(sampleWidgets);
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (updatedWidgets: DashboardWidget[], layouts: any) => {
    try {
      const deviceId = getDeviceId();

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("Updating dashboard:", { widgets: updatedWidgets, layouts, deviceId });

      setWidgets(updatedWidgets);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update dashboard:", error);
      alert("Failed to update dashboard");
    }
  };

  const handleDelete = async () => {
    try {
      const deviceId = getDeviceId();

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log("Deleting dashboard:", params.id);

      router.push("/analytics/dashboards");
    } catch (error) {
      console.error("Failed to delete dashboard:", error);
      alert("Failed to delete dashboard");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push("/analytics/dashboards")}
              className="text-blue-600 dark:text-blue-400 hover:underline mb-2"
            >
              ← Back to Dashboards
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {dashboard.name}
            </h1>
          </div>

          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Delete
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dashboard */}
      <DashboardBuilder
        dashboardId={dashboard.id}
        initialWidgets={widgets}
        onSave={handleSave}
        editable={isEditing}
      />

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Delete Dashboard?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete "{dashboard.name}"? This action cannot be
              undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
