"use client";

import { useState } from "react";
import {
  ForecastChart,
  ForecastMetrics,
  type ForecastDataPoint,
} from "@/components/visualizations/forecasts/ForecastChart";
import { HubPage } from "@/components/hub";

interface ForecastItem {
  id: string;
  topic: string;
  model: string;
  horizon: number;
}

const SAMPLE_FORECASTS: ForecastItem[] = [
  { id: "f1", topic: "machine-learning", model: "prophet", horizon: 30 },
  { id: "f2", topic: "large-language-models", model: "prophet", horizon: 45 },
  { id: "f3", topic: "computer-vision", model: "arima", horizon: 30 },
];

const SAMPLE_HISTORICAL = Array.from({ length: 60 }, (_, i) => ({
  date: new Date(Date.now() - (60 - i) * 86400000).toISOString().slice(0, 10),
  value: 50 + Math.sin(i / 7) * 20 + Math.random() * 10,
}));

const SAMPLE_FORECAST: ForecastDataPoint[] = Array.from({ length: 30 }, (_, i) => {
  const base = 55 + Math.sin((60 + i) / 7) * 18;
  const noise = Math.random() * 6 - 3;
  return {
    date: new Date(Date.now() + (i + 1) * 86400000).toISOString().slice(0, 10),
    value: Math.round((base + noise) * 100) / 100,
    lower: Math.round((base + noise - 12) * 100) / 100,
    upper: Math.round((base + noise + 12) * 100) / 100,
    trend: Math.round((base - 5 + noise * 0.3) * 100) / 100,
  };
});

const SAMPLE_METRICS = { mae: 3.42, rmse: 4.81, mape: 6.8, r2: 0.87 };

export default function ForecastsPage() {
  const [selected, setSelected] = useState<ForecastItem>(SAMPLE_FORECASTS[0]);
  const [showBands, setShowBands] = useState(true);
  const [showComponents, setShowComponents] = useState(false);

  return (
    <div className="page-wrap page-stack">
      <HubPage
        eyebrow="Analytics"
        title="Forecasts"
        description="Time-series forecasts with confidence intervals. View predicted trends for topics and metrics."
      >
        <div className="space-y-6">
          {/* Forecast selector */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Select forecast:</span>
            {SAMPLE_FORECASTS.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelected(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  selected.id === f.id
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-background border-border hover:bg-muted"
                }`}
              >
                {f.topic.replace(/-/g, " ")}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showBands}
                onChange={(e) => setShowBands(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              Confidence bands
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showComponents}
                onChange={(e) => setShowComponents(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              Trend component
            </label>
            <span className="text-muted-foreground">
              Model: {selected.model.toUpperCase()} • Horizon: {selected.horizon} days
            </span>
          </div>

          {/* Chart */}
          <div className="surface-card p-6">
            <ForecastChart
              historical={SAMPLE_HISTORICAL}
              forecast={SAMPLE_FORECAST}
              title={`Forecast: ${selected.topic.replace(/-/g, " ")}`}
              height={420}
              showConfidenceBands={showBands}
              showComponents={showComponents}
            />
          </div>

          {/* Metrics */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Model Performance Metrics
            </h3>
            <ForecastMetrics metrics={SAMPLE_METRICS} />
          </div>

          {/* Note */}
          <p className="text-xs text-muted-foreground">
            Forecasts are illustrative using synthetic data. Connect BACKEND_URL to a running
            ai-web-feeds backend with forecasting enabled to load live predictions.
          </p>
        </div>
      </HubPage>
    </div>
  );
}
