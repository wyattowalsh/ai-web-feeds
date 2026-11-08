"use client";

import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Legend,
  Title,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type TooltipItem,
} from "chart.js";
import { ChartShell } from "@/components/analytics/chart-shell";
import { getAnalyticsChartTheme } from "@/components/analytics/chart-theme";
import { useTheme } from "@/lib/theme-manager";

ChartJS.register(ArcElement, Tooltip, Legend, Title);

export interface HealthDistribution {
  healthy: number;
  moderate: number;
  unhealthy: number;
}

interface HealthDistributionChartProps {
  distribution?: HealthDistribution | null;
  error?: string | null;
}

function isFiniteCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function countsFromDistribution(
  distribution: HealthDistribution | null | undefined,
): HealthDistribution | null {
  if (distribution == null) {
    return null;
  }

  const { healthy, moderate, unhealthy } = distribution;
  if (!isFiniteCount(healthy) || !isFiniteCount(moderate) || !isFiniteCount(unhealthy)) {
    return null;
  }

  if (healthy === 0 && moderate === 0 && unhealthy === 0) {
    return null;
  }

  return { healthy, moderate, unhealthy };
}

function shareText(count: number, counts: HealthDistribution): string {
  const counted = counts.healthy + counts.moderate + counts.unhealthy;
  if (counted === 0) {
    return "0.0%";
  }

  return `${((count / counted) * 100).toFixed(1)}%`;
}

function CountGrid({ counts }: { counts: HealthDistribution }) {
  const bands = [
    {
      key: "healthy" as const,
      label: "Healthy",
      value: counts.healthy,
      cardClassName:
        "rounded-2xl border border-[color:color-mix(in_oklab,var(--success-tone)_24%,var(--line))] bg-[color:color-mix(in_oklab,var(--success-tone)_12%,var(--surface))] p-4",
      valueClassName: "mt-2 text-3xl font-semibold tabular-nums text-[color:var(--success-tone)]",
    },
    {
      key: "moderate" as const,
      label: "Moderate",
      value: counts.moderate,
      cardClassName:
        "rounded-2xl border border-[color:color-mix(in_oklab,var(--warning-tone)_24%,var(--line))] bg-[color:color-mix(in_oklab,var(--warning-tone)_12%,var(--surface))] p-4",
      valueClassName: "mt-2 text-3xl font-semibold tabular-nums text-[color:var(--warning-tone)]",
    },
    {
      key: "unhealthy" as const,
      label: "Unhealthy",
      value: counts.unhealthy,
      cardClassName:
        "rounded-2xl border border-[color:color-mix(in_oklab,var(--danger-tone)_24%,var(--line))] bg-[color:color-mix(in_oklab,var(--danger-tone)_12%,var(--surface))] p-4",
      valueClassName: "mt-2 text-3xl font-semibold tabular-nums text-[color:var(--danger-tone)]",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 text-center">
      {bands.map((band) => (
        <div key={band.key} className={band.cardClassName}>
          <p className="metric-label">{band.label}</p>
          <p className={band.valueClassName} data-health-count={band.key}>
            {band.value}
          </p>
          <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
            {shareText(band.value, counts)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function HealthDistributionChart({
  distribution = null,
  error = null,
}: HealthDistributionChartProps) {
  const counts = countsFromDistribution(distribution);
  const errorMessage = typeof error === "string" ? error.trim() : "";
  const hasError = errorMessage.length > 0;
  const showChart = counts !== null && !hasError;
  const { isDark } = useTheme();
  const chartTheme = getAnalyticsChartTheme(isDark);

  let chartData: ChartData<"pie", number[], string> | null = null;
  let options: ChartOptions<"pie"> | null = null;

  if (showChart && counts !== null) {
    chartData = {
      labels: ["Healthy (≥0.8)", "Moderate (0.5-0.8)", "Unhealthy (<0.5)"],
      datasets: [
        {
          label: "Feed Count",
          data: [counts.healthy, counts.moderate, counts.unhealthy],
          backgroundColor: [chartTheme.successSoft, chartTheme.warningSoft, chartTheme.dangerSoft],
          borderColor: [chartTheme.success, chartTheme.warning, chartTheme.danger],
          borderWidth: 2,
        },
      ],
    };

    options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: chartTheme.textMuted,
          },
        },
        tooltip: {
          callbacks: {
            label: (context: TooltipItem<"pie">) => {
              const value = typeof context.raw === "number" ? context.raw : Number.NaN;
              const label = context.label ?? "";
              if (!Number.isFinite(value)) {
                return label;
              }

              return `${label}: ${value} (${shareText(value, counts)})`;
            },
          },
        },
      },
    };
  }

  return (
    <ChartShell
      eyebrow="Reliability"
      title="Health distribution"
      description="Healthy, moderate, and unhealthy bands make it easier to reason about quality and maintenance posture across the catalog."
      empty={counts === null && !hasError}
      error={hasError ? errorMessage : null}
      footer={showChart && counts !== null ? <CountGrid counts={counts} /> : null}
    >
      {showChart && chartData !== null && options !== null ? (
        <div className="h-96" data-demo="false">
          <Pie data={chartData} options={options} />
        </div>
      ) : null}
    </ChartShell>
  );
}
