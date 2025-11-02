/**
 * Forecasts page.
 *
 * Implements Phase 6 (US4): Time-series forecasting
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ForecastChart, ForecastMetrics } from "@/components/visualizations/forecasts/ForecastChart";
import { getDeviceId } from "@/lib/visualization/device-id";

interface Forecast {
  id: number;
  data_source: string;
  horizon_days: number;
  confidence_level: number;
  metrics: Record<string, number>;
  created_at: string;
}

export default function ForecastsPage() {
  const router = useRouter();
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [selectedForecast, setSelectedForecast] = useState<Forecast | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadForecasts();
  }, []);

  const loadForecasts = async () => {
    setIsLoading(true);

    try {
      const deviceId = getDeviceId();

      // Simulate API call with sample data
      await new Promise((resolve) => setTimeout(resolve, 500));

      const sampleForecasts: Forecast[] = [
        {
          id: 1,
          data_source: "topics",
          horizon_days: 30,
          confidence_level: 0.95,
          metrics: { mae: 12.5, rmse: 15.8, mape: 8.2, r2: 0.92 },
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 2,
          data_source: "articles",
          horizon_days: 14,
          confidence_level: 0.95,
          metrics: { mae: 25.3, rmse: 32.1, mape: 12.5, r2: 0.88 },
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      setForecasts(sampleForecasts);
      if (sampleForecasts.length > 0) {
        setSelectedForecast(sampleForecasts[0]);
      }
    } catch (error) {
      console.error("Failed to load forecasts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading forecasts...</p>
        </div>
      </div>
    );
  }

  // Generate sample data for visualization
  const historical = Array.from({ length: 90 }, (_, i) => ({
    date: new Date(Date.now() - (90 - i) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    value: 100 + i * 0.5 + Math.sin(i / 7) * 10 + Math.random() * 5,
  }));

  const forecastData = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    value: 145 + i * 0.5 + Math.sin((90 + i) / 7) * 10,
    lower: 140 + i * 0.5 + Math.sin((90 + i) / 7) * 10,
    upper: 150 + i * 0.5 + Math.sin((90 + i) / 7) * 10,
    trend: 145 + i * 0.5,
    seasonal: Math.sin((90 + i) / 7) * 10,
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Time-Series Forecasting
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Generate and view predictive forecasts using Prophet
            </p>
          </div>

          <button
            onClick={() => router.push("/analytics/forecasts/new")}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            + New Forecast
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Forecasts list */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Saved Forecasts
              </h2>

              {forecasts.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No forecasts yet
                </p>
              ) : (
                <div className="space-y-2">
                  {forecasts.map((forecast) => (
                    <button
                      key={forecast.id}
                      onClick={() => setSelectedForecast(forecast)}
                      className={`w-full text-left p-3 rounded-lg border transition ${
                        selectedForecast?.id === forecast.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                        {forecast.data_source}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {forecast.horizon_days} days
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {new Date(forecast.created_at).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Forecast visualization */}
          <div className="lg:col-span-3 space-y-6">
            {selectedForecast ? (
              <>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                  <ForecastChart
                    historical={historical}
                    forecast={forecastData}
                    title={`${selectedForecast.data_source} Forecast (${selectedForecast.horizon_days} days)`}
                    height={400}
                    showConfidenceBands={true}
                    showComponents={false}
                  />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Model Performance Metrics
                  </h3>
                  <ForecastMetrics metrics={selectedForecast.metrics} />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Forecast Details
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Data Source
                      </p>
                      <p className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                        {selectedForecast.data_source}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Horizon
                      </p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {selectedForecast.horizon_days} days
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Confidence Level
                      </p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {(selectedForecast.confidence_level * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Created
                      </p>
                      <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                        {new Date(selectedForecast.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
                <div className="text-6xl mb-4">📈</div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Select a Forecast
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Choose a forecast from the list to view details
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Info panel */}
        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
            About Forecasting
          </h3>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>• Uses <strong>Prophet</strong> by Meta for accurate time-series forecasting</li>
            <li>• Automatically detects <strong>trends, seasonality, and holidays</strong></li>
            <li>• Provides <strong>confidence intervals</strong> for uncertainty quantification</li>
            <li>• Evaluates model performance with MAE, RMSE, MAPE, and R² metrics</li>
            <li>• Forecast up to <strong>365 days</strong> into the future</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
