"use client";

import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from "chart.js";
import { ChartShell } from "@/components/analytics/chart-shell";
import { ChartSkeleton } from "@/components/analytics/chart-skeleton";
import { getAnalyticsChartTheme } from "@/components/analytics/chart-theme";
import { useTheme } from "@/lib/theme-manager";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface VelocityData {
  granularity: string;
  data_points: Array<{ date: string; count: number }>;
  avg_per_feed: number;
  most_active_feed: { id: string; title: string; count: number } | null;
  least_active_feed: { id: string; title: string; count: number } | null;
}

export function VelocityChart({
  dateRange = "30d",
  granularity = "daily",
}: {
  dateRange?: string;
  granularity?: "daily" | "weekly" | "monthly";
}) {
  const [velocity, setVelocity] = useState<VelocityData | null>(null);
  const [loading, setLoading] = useState(true);
  const { isDark } = useTheme();
  const chartTheme = getAnalyticsChartTheme(isDark);

  useEffect(() => {
    const fetchVelocity = async () => {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/analytics/velocity?granularity=${granularity}&date_range=${dateRange}`,
        );
        if (!response.ok) throw new Error("Failed to fetch velocity data");

        const data = await response.json();
        setVelocity(data);
      } catch (err) {
        console.error("Error fetching velocity:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVelocity();
  }, [dateRange, granularity]);

  if (loading || !velocity) {
    return <ChartSkeleton className="h-[34rem]" />;
  }

  const chartData = {
    labels: velocity.data_points.map((dp) => dp.date),
    datasets: [
      {
        label: "Validation Count",
        data: velocity.data_points.map((dp) => dp.count),
        fill: true,
        backgroundColor: chartTheme.successSoft,
        borderColor: chartTheme.success,
        borderWidth: 2,
        tension: 0.4,
        pointBackgroundColor: chartTheme.success,
        pointBorderColor: chartTheme.success,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: chartTheme.textMuted,
        },
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: chartTheme.textMuted,
        },
        grid: {
          color: chartTheme.grid,
        },
        title: {
          display: true,
          text: "Validation Count",
          color: chartTheme.textMuted,
        },
      },
      x: {
        ticks: {
          color: chartTheme.textMuted,
          maxRotation: 45,
          minRotation: 45,
        },
        grid: {
          display: false,
        },
        title: {
          display: true,
          text: "Date",
          color: chartTheme.textMuted,
        },
      },
    },
  };

  return (
    <ChartShell
      eyebrow="Velocity"
      title="Publication velocity"
      description="Validation counts are used as a practical proxy for ongoing publication activity across the catalog."
      footer={
        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
          <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-4">
            <p className="metric-label">Average per feed</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-[color:var(--brand-strong)]">
              {velocity.avg_per_feed.toFixed(1)}
            </p>
          </div>

          {velocity.most_active_feed ? (
            <div className="rounded-2xl border border-[color:color-mix(in_oklab,var(--success-tone)_24%,var(--line))] bg-[color:color-mix(in_oklab,var(--success-tone)_12%,var(--surface))] p-4">
              <p className="metric-label">Most active</p>
              <p className="mt-2 text-sm font-semibold text-[color:var(--ink)]">
                {velocity.most_active_feed.title}
              </p>
              <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
                {velocity.most_active_feed.count} validations
              </p>
            </div>
          ) : null}

          {velocity.least_active_feed ? (
            <div className="rounded-2xl border border-[color:color-mix(in_oklab,var(--warning-tone)_24%,var(--line))] bg-[color:color-mix(in_oklab,var(--warning-tone)_12%,var(--surface))] p-4">
              <p className="metric-label">Least active</p>
              <p className="mt-2 text-sm font-semibold text-[color:var(--ink)]">
                {velocity.least_active_feed.title}
              </p>
              <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
                {velocity.least_active_feed.count} validation
                {velocity.least_active_feed.count !== 1 ? "s" : ""}
              </p>
            </div>
          ) : null}
        </div>
      }
    >
      <div className="h-96">
        <Line data={chartData} options={options} />
      </div>
    </ChartShell>
  );
}
