"use client";

import { useEffect, useState } from "react";
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
import { ChartSkeleton } from "@/components/analytics/chart-skeleton";
import { getAnalyticsChartTheme } from "@/components/analytics/chart-theme";
import { useTheme } from "@/lib/theme-manager";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface TrendingTopic {
  topic: string;
  feed_count: number;
  validation_frequency: number;
  avg_health_score: number;
}

export function TrendingTopicsChart({
  dateRange = "30d",
  limit = 10,
}: {
  dateRange?: string;
  limit?: number;
}) {
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isDark } = useTheme();
  const chartTheme = getAnalyticsChartTheme(isDark);

  useEffect(() => {
    const fetchTopics = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/analytics/trending?limit=${limit}&date_range=${dateRange}`,
        );
        if (!response.ok) throw new Error("Failed to fetch trending topics");

        const data = await response.json();
        setTopics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchTopics();
  }, [dateRange, limit]);

  if (loading) {
    return <ChartSkeleton className="h-[32rem]" />;
  }

  if (error || topics.length === 0) {
    return (
      <ChartShell
        eyebrow="Topic momentum"
        title="Trending topics"
        description="Weighted validation activity is used here as a proxy for current attention and movement inside the catalog."
      >
        <div className="rounded-2xl border border-[color:var(--warning-tone)]/40 bg-[color:color-mix(in_oklab,var(--warning-tone)_12%,var(--surface))] p-5 text-[color:var(--ink)]">
          <p className="text-lg font-semibold">No trending topics available</p>
          <p className="small-note mt-2">{error || "Run analytics snapshot first"}</p>
        </div>
      </ChartShell>
    );
  }

  const chartData = {
    labels: topics.map((t) => t.topic.toUpperCase()),
    datasets: [
      {
        label: "Validation Frequency",
        data: topics.map((t) => t.validation_frequency),
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
        position: "top" as const,
        labels: {
          color: chartTheme.textMuted,
        },
      },
      tooltip: {
        callbacks: {
          afterLabel: (context: TooltipItem<"bar">) => {
            const topic = topics[context.dataIndex];
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
      footer={
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {topics.map((topic) => (
            <div
              key={topic.topic}
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
      }
    >
      <div className="h-96">
        <Bar data={chartData} options={options} />
      </div>
    </ChartShell>
  );
}
