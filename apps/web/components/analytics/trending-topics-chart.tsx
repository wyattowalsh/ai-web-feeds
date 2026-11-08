"use client";

import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
  type TooltipItem,
} from "chart.js";
import { ChartShell } from "@/components/analytics/chart-shell";
import { getAnalyticsChartTheme } from "@/components/analytics/chart-theme";
import { useTheme } from "@/lib/theme-manager";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface TrendingTopic {
  topic: string;
  feed_count: number;
  validation_frequency: number;
  avg_health_score: number;
}

interface TrendingTopicsChartProps {
  topics?: TrendingTopic[] | null;
  error?: string | null;
  // Existing callers still pass these. They do not load or invent topic rows.
  dateRange?: string;
  limit?: number;
}

export function TrendingTopicsChart({ topics = [], error = null }: TrendingTopicsChartProps) {
  const { isDark } = useTheme();
  const chartTheme = getAnalyticsChartTheme(isDark);
  const rows = Array.isArray(topics) ? topics : [];
  const errorMessage = typeof error === "string" ? error.trim() : "";
  const showChart = errorMessage.length === 0 && rows.length > 0;

  const chartData = {
    labels: rows.map((row) => row.topic),
    datasets: [
      {
        label: "Validation Frequency",
        data: rows.map((row) => row.validation_frequency),
        backgroundColor: chartTheme.accentSoft,
        borderColor: chartTheme.accent,
        borderWidth: 1,
        borderRadius: 10,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: chartTheme.textMuted,
        },
      },
      tooltip: {
        callbacks: {
          afterLabel: (context: TooltipItem<"bar">) => {
            const topic = rows[context.dataIndex];
            if (!topic) {
              return "";
            }
            return [
              `Feed Count: ${topic.feed_count}`,
              `Avg Health: ${(topic.avg_health_score * 100).toFixed(1)}%`,
            ];
          },
        },
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
          text: "Validation Frequency",
          color: chartTheme.textMuted,
        },
      },
      x: {
        ticks: {
          color: chartTheme.textMuted,
        },
        grid: {
          display: false,
        },
        title: {
          display: true,
          text: "Topic",
          color: chartTheme.textMuted,
        },
      },
    },
  };

  return (
    <ChartShell
      eyebrow="Topic momentum"
      title="Trending topics"
      description="Weighted validation frequency helps surface the parts of the catalog drawing the most recent operational attention."
      empty={rows.length === 0}
      error={errorMessage || null}
      footer={
        showChart ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {rows.map((topic, index) => (
              <div
                key={`${topic.topic}-${index}`}
                className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-3 text-center"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--ink-muted)]">
                  {topic.topic}
                </p>
                <p className="mt-2 text-base font-semibold text-[color:var(--ink)]">
                  {topic.feed_count} feeds
                </p>
                <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
                  {(topic.avg_health_score * 100).toFixed(0)}% health
                </p>
              </div>
            ))}
          </div>
        ) : null
      }
    >
      {showChart ? (
        <div className="h-96" data-demo="false">
          <Bar data={chartData} options={options} />
        </div>
      ) : null}
    </ChartShell>
  );
}
