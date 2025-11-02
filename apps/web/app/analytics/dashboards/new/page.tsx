/**
 * New dashboard page.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardBuilder } from "@/components/visualizations/dashboards/DashboardBuilder";
import { getDeviceId } from "@/lib/visualization/device-id";

export default function NewDashboardPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (widgets: any[], layouts: any) => {
    if (!name.trim()) {
      alert("Please enter a dashboard name");
      return;
    }

    setIsSaving(true);

    try {
      const deviceId = getDeviceId();

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("Saving dashboard:", { name, widgets, layouts, deviceId });

      router.push("/analytics/dashboards");
    } catch (error) {
      console.error("Failed to save dashboard:", error);
      alert("Failed to save dashboard");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => router.push("/analytics/dashboards")}
            className="text-blue-600 dark:text-blue-400 hover:underline mb-2"
          >
            ← Back to Dashboards
          </button>
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dashboard Name"
              className="flex-1 max-w-md px-4 py-2 text-xl font-semibold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
      </div>

      {/* Dashboard Builder */}
      <DashboardBuilder onSave={handleSave} editable={true} />

      {/* Saving overlay */}
      {isSaving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl">
            <div className="flex items-center gap-4">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Saving Dashboard...
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Please wait
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
