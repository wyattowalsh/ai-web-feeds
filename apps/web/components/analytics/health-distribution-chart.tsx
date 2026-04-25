"use client";

import { useEffect, useState } from "react";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Title,
  type ChartOptions,
  type TooltipItem,
} from "chart.js";
import { ChartShell } from "@/components/analytics/chart-shell";
import { ChartSkeleton } from "@/components/analytics/chart-skeleton";
import { getAnalyticsChartTheme } from "@/components/analytics/chart-theme";
import { useTheme } from "@/lib/theme-manager";

ChartJS.register(ArcElement, Tooltip, Legend, Title);

interface TopicDistributionPayload {
  topic_distribution: Array<{ topic: string; count: number }>;
}

export function HealthDistributionChart({
  dateRange = "30d",
  topic,
}: {
  dateRange?: string;
  topic?: string;
}) {
  const [distribution, setDistribution] = useState<TopicDistributionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const { isDark } = useTheme();
  const chartTheme = getAnalyticsChartTheme(isDark);

  useEffect(() => {
    const fetchDistribution = async () => {
      setLoading(true);

      try {
        const params = new URLSearchParams({ date_range: dateRange });
        if (topic) {
          params.set("topic", topic);
        }

        const response = await fetch(`/api/analytics/summary?${params}`);
        if (!response.ok) {
          throw new Error("Failed to fetch topic distribution");
        }

        const data = (await response.json()) as TopicDistributionPayload;
        setDistribution({ topic_distribution: data.topic_distribution || [] });
      } catch (err) {
        console.error("Error fetching topic distribution:", err);
      } finally {
        setLoading(false);
      }
    };

    void fetchDistribution();
  }, [dateRange, topic]);

  if (loading || !distribution) {
    return <ChartSkeleton className="h-[32rem]" />;
  }

  const topics = distribution.topic_distribution.slice(0, 5);
  const total = topics.reduce((sum, topicEntry) => sum + topicEntry.count, 0);

  const chartData = {
    labels: topics.map((topicEntry) => topicEntry.topic.toUpperCase()),
    datasets: [
      {
        label: "Source Count",
        data: topics.map((topicEntry) => topicEntry.count),
        backgroundColor: [
          chartTheme.successSoft,
          chartTheme.warningSoft,
          chartTheme.dangerSoft,
          chartTheme.accentSoft,
          "color-mix(in oklab, var(--brand) 18%, white)",
        ],
        borderColor: [
          chartTheme.success,
          chartTheme.warning,
          chartTheme.danger,
          chartTheme.accent,
          "var(--brand)",
        ],
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
          label: (context: TooltipItem<"pie">) => {
            const value = typeof context.raw === "number" ? context.raw : Number(context.raw);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <ChartShell
      eyebrow="Coverage"
      title="Topic distribution"
      description="A top-level topic breakdown of the selected catalog slice, useful for spotting where source coverage is concentrated."
      footer={
        <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-5">
          {topics.map((topicEntry) => (
            <div
              key={topicEntry.topic}
              className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-4"
            >
              <p className="metric-label">{topicEntry.topic}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-[color:var(--ink)]">
                {topicEntry.count}
              </p>
              <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
                {total > 0 ? ((topicEntry.count / total) * 100).toFixed(1) : "0.0"}%
              </p>
            </div>
          ))}
        </div>
      }
    >
      <div className="h-96">
        <Pie data={chartData} options={options} />
      </div>
    </ChartShell>
  );
}
