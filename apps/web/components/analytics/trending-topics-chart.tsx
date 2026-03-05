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
} from "chart.js";

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
    return (
      <div className="bg-gray-200 rounded-lg h-96 animate-pulse flex items-center justify-center">
        <p className="text-gray-600">Loading trending topics...</p>
      </div>
    );
  }

  if (error || topics.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
        <p className="font-semibold">No trending topics available</p>
        <p className="text-sm">{error || "Run analytics snapshot first"}</p>
      </div>
    );
  }

  const chartData = {
    labels: topics.map((t) => t.topic.toUpperCase()),
    datasets: [
      {
        label: "Validation Frequency",
        data: topics.map((t) => t.validation_frequency),
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderColor: "rgb(59, 130, 246)",
        borderWidth: 1,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: `Most Active Topics (${dateRange})`,
        font: {
          size: 16,
          weight: "bold",
        },
      },
      tooltip: {
        callbacks: {
          afterLabel: (context: any) => {
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
        title: {
          display: true,
          text: "Validation Frequency",
        },
      },
      x: {
        title: {
          display: true,
          text: "Topic",
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="h-96">
        <Bar data={chartData} options={options} />
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
        {topics.map((topic) => (
          <div key={topic.topic} className="text-center">
            <p className="text-xs font-semibold text-gray-600 uppercase">{topic.topic}</p>
            <p className="text-sm text-gray-500">{topic.feed_count} feeds</p>
            <p className="text-xs text-gray-400">
              {(topic.avg_health_score * 100).toFixed(0)}% health
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
