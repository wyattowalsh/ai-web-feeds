/**
 * New visualization page with chart builder.
 *
 * Implements T013-T032: Complete interactive visualization builder
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChartBuilder, type ChartConfiguration } from "@/components/visualizations/ChartBuilder";
import { getDeviceId } from "@/lib/visualization/device-id";
import { createVisualization } from "@/lib/visualization/api-client";

export default function NewVisualizationPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (config: ChartConfiguration) => {
    setIsSaving(true);
    setError(null);

    try {
      const deviceId = getDeviceId();

      // Create visualization via API
      const visualization = await createVisualization({
        device_id: deviceId,
        name: config.customization.title ?? `${config.chartType} - ${config.dataSource}`,
        chart_type: config.chartType,
        data_source: config.dataSource,
        filters: {
          date_range: config.dateRange,
          date_preset: config.datePreset,
        },
        customization: config.customization,
      });

      console.log("Visualization created:", visualization);

      // Redirect to visualizations list
      router.push("/analytics/visualizations");
    } catch (err) {
      console.error("Failed to save visualization:", err);
      setError(err instanceof Error ? err.message : "Failed to save visualization");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Create New Visualization
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Build an interactive chart from your data sources
          </p>
        </div>

        {/* Error alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="text-red-500 text-xl">⚠️</span>
              <div className="flex-1">
                <h4 className="font-medium text-red-900 dark:text-red-100 mb-1">
                  Save Failed
                </h4>
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Chart builder */}
        <ChartBuilder onSave={handleSave} />

        {/* Saving overlay */}
        {isSaving && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl">
              <div className="flex items-center gap-4">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Saving Visualization...
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Please wait while we save your chart
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
