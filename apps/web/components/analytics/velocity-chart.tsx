"use client";

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

interface VelocityPoint {
  date: string;
  count: number;
}

interface VelocityFeedSummary {
  id: string;
  title: string;
  count: number;
}

interface VelocityChartProps {
  data_points?: VelocityPoint[] | null;
  avg_per_feed?: number | null;
  most_active_feed?: VelocityFeedSummary | null;
  least_active_feed?: VelocityFeedSummary | null;
  error?: string | null;
}

export function VelocityChart({
  data_points,
  avg_per_feed = null,
  most_active_feed = null,
  least_active_feed = null,
  error = null,
}: VelocityChartProps) {
  const { isDark } = useTheme();
  const chartTheme = getAnalyticsChartTheme(isDark);
  const points = Array.isArray(data_points) ? data_points : [];
  const errorMessage = typeof error === "string" ? error.trim() : "";
  const averagePerFeed =
    typeof avg_per_feed === "number" && Number.isFinite(avg_per_feed) ? avg_per_feed : null;
  const series = {
    demo: false,
    labels: points.map((point) => point.date),
    counts: points.map((point) => point.count),
  };

  const chartData = {
    labels: series.labels,
    datasets: [
      {
        label: "Validation Count",
        data: series.counts,
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

  const footer =
    averagePerFeed !== null || most_active_feed || least_active_feed ? (
      <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
        {averagePerFeed !== null ? (
          <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-4">
            <p className="metric-label">Average per feed</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-[color:var(--brand-strong)]">
              {averagePerFeed.toFixed(1)}
            </p>
          </div>
        ) : null}

        {most_active_feed ? (
          <div className="rounded-2xl border border-[color:color-mix(in_oklab,var(--success-tone)_24%,var(--line))] bg-[color:color-mix(in_oklab,var(--success-tone)_12%,var(--surface))] p-4">
            <p className="metric-label">Most active</p>
            <p className="mt-2 text-sm font-semibold text-[color:var(--ink)]">
              {most_active_feed.title}
            </p>
            <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
              {most_active_feed.count} validations
            </p>
          </div>
        ) : null}

        {least_active_feed ? (
          <div className="rounded-2xl border border-[color:color-mix(in_oklab,var(--warning-tone)_24%,var(--line))] bg-[color:color-mix(in_oklab,var(--warning-tone)_12%,var(--surface))] p-4">
            <p className="metric-label">Least active</p>
            <p className="mt-2 text-sm font-semibold text-[color:var(--ink)]">
              {least_active_feed.title}
            </p>
            <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
              {least_active_feed.count} validation
              {least_active_feed.count !== 1 ? "s" : ""}
            </p>
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <ChartShell
      eyebrow="Velocity"
      title="Publication velocity"
      description="Validation counts are used as a practical proxy for ongoing publication activity across the catalog."
      empty={points.length === 0}
      error={errorMessage.length > 0 ? errorMessage : null}
      footer={footer}
    >
      <div className="space-y-4" data-demo={`${series.demo}`}>
        <div className="h-96">
          <Line data={chartData} options={options} />
        </div>
        <ul aria-label="Velocity points" className="space-y-2">
          {points.map((point, index) => (
            <li
              key={`${point.date}-${index}`}
              className="flex items-baseline justify-between gap-4 text-sm text-[color:var(--ink)]"
            >
              <span>{point.date}</span>
              <span className="tabular-nums">{point.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartShell>
  );
}
