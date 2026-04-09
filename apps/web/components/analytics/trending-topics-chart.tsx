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
  recent_post_count: number;
  share: number;
}

export function TrendingTopicsChart({
  dateRange = "30d",
  topic,
  limit = 10,
}: {
  dateRange?: string;
  topic?: string;
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
        const params = new URLSearchParams({
          limit: String(limit),
          date_range: dateRange,
        });
        if (topic) {
          params.set("topic", topic);
        }

        const response = await fetch(`/api/analytics/trending?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to fetch trending topics");

        const data = await response.json();
        setTopics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    void fetchTopics();
  }, [dateRange, limit, topic]);

  if (loading) {
    return <ChartSkeleton className="h-[32rem]" />;
  }

  if (error || topics.length === 0) {
    return (
      <ChartShell
        eyebrow="Topic momentum"
        title="Trending topics"
        description="Recent post volume is used here to show which topics are most active in the current catalog slice."
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
        label: "Recent Post Count",
        data: topics.map((t) => t.recent_post_count),
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
              `Share of recent posts: ${(topic.share * 100).toFixed(1)}%`,
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
          text: "Recent Post Count",
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
      description="Recent post counts grouped by topic show where publication energy is concentrated in the shipped catalog."
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
                {topic.recent_post_count} posts • {(topic.share * 100).toFixed(0)}% share
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
