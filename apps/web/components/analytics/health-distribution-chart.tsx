"use client";

import { useEffect, useState } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title, type ChartOptions } from "chart.js";
import { ChartShell } from "@/components/analytics/chart-shell";
import { ChartSkeleton } from "@/components/analytics/chart-skeleton";
import { getAnalyticsChartTheme } from "@/components/analytics/chart-theme";
import { useTheme } from "@/lib/theme-manager";

ChartJS.register(ArcElement, Tooltip, Legend, Title);

interface HealthDistribution {
  healthy: number;
  moderate: number;
  unhealthy: number;
}

export function HealthDistributionChart({
  dateRange = "30d",
  topic,
}: {
  dateRange?: string;
  topic?: string;
}) {
  const [distribution, setDistribution] = useState<HealthDistribution | null>(null);
  const [loading, setLoading] = useState(true);
  const { isDark } = useTheme();
  const chartTheme = getAnalyticsChartTheme(isDark);

  useEffect(() => {
    const fetchDistribution = async () => {
      setLoading(true);

      try {
        const params = new URLSearchParams({ date_range: dateRange });
        if (topic) params.set("topic", topic);

        const response = await fetch(`/api/analytics/summary?${params}`);
        if (!response.ok) throw new Error("Failed to fetch data");

        const data = await response.json();
        setDistribution(data.health_distribution);
      } catch (err) {
        console.error("Error fetching health distribution:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDistribution();
  }, [dateRange, topic]);

  if (loading || !distribution) {
    return <ChartSkeleton className="h-[32rem]" />;
  }

  const total = distribution.healthy + distribution.moderate + distribution.unhealthy;

  const chartData = {
    labels: ["Healthy (≥0.8)", "Moderate (0.5-0.8)", "Unhealthy (<0.5)"],
    datasets: [
      {
        label: "Feed Count",
        data: [distribution.healthy, distribution.moderate, distribution.unhealthy],
        backgroundColor: [chartTheme.successSoft, chartTheme.warningSoft, chartTheme.dangerSoft],
        borderColor: [chartTheme.success, chartTheme.warning, chartTheme.danger],
        borderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<"pie"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: chartTheme.textMuted,
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.raw;
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <ChartShell
      eyebrow="Reliability"
      title="Health distribution"
      description="Healthy, moderate, and unhealthy bands make it easier to reason about quality and maintenance posture across the catalog."
      footer={
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-2xl border border-[color:color-mix(in_oklab,var(--success-tone)_24%,var(--line))] bg-[color:color-mix(in_oklab,var(--success-tone)_12%,var(--surface))] p-4">
            <p className="metric-label">Healthy</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-[color:var(--success-tone)]">
              {distribution.healthy}
            </p>
            <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
              {((distribution.healthy / total) * 100).toFixed(1)}%
            </p>
          </div>

          <div className="rounded-2xl border border-[color:color-mix(in_oklab,var(--warning-tone)_24%,var(--line))] bg-[color:color-mix(in_oklab,var(--warning-tone)_12%,var(--surface))] p-4">
            <p className="metric-label">Moderate</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-[color:var(--warning-tone)]">
              {distribution.moderate}
            </p>
            <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
              {((distribution.moderate / total) * 100).toFixed(1)}%
            </p>
          </div>

          <div className="rounded-2xl border border-[color:color-mix(in_oklab,var(--danger-tone)_24%,var(--line))] bg-[color:color-mix(in_oklab,var(--danger-tone)_12%,var(--surface))] p-4">
            <p className="metric-label">Unhealthy</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-[color:var(--danger-tone)]">
              {distribution.unhealthy}
            </p>
            <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
              {((distribution.unhealthy / total) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      }
    >
      <div className="h-96">
        <Pie data={chartData} options={options} />
      </div>
    </ChartShell>
  );
}
