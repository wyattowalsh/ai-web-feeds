"use client";

import { useEffect, useState } from "react";
import { Activity, CircleGauge, RadioTower, ShieldCheck } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";

interface SummaryMetrics {
  total_feeds: number;
  active_feeds: number;
  validation_success_rate: number;
  avg_response_time: number;
  health_distribution: {
    healthy: number;
    moderate: number;
    unhealthy: number;
  };
  last_updated: string;
}

export function SummaryMetrics({
  dateRange = "30d",
  topic,
}: {
  dateRange?: string;
  topic?: string;
}) {
  const [metrics, setMetrics] = useState<SummaryMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ date_range: dateRange });
        if (topic) params.set("topic", topic);

        const response = await fetch(`/api/analytics/summary?${params}`);
        if (!response.ok) throw new Error("Failed to fetch metrics");

        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [dateRange, topic]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="surface-card space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="h-4 w-24 animate-pulse rounded-full bg-[color:var(--surface-muted)]" />
                <div className="h-10 w-28 animate-pulse rounded-full bg-[color:var(--surface-muted)]" />
                <div className="h-4 w-36 animate-pulse rounded-full bg-[color:var(--surface-muted)]" />
              </div>
              <div className="h-12 w-12 animate-pulse rounded-2xl bg-[color:var(--surface-muted)]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="surface-card border-(--danger-tone)/40 text-(--ink)">
        <p className="text-lg font-semibold">Error loading metrics</p>
        <p className="small-note mt-2">{error || "No data available"}</p>
      </div>
    );
  }

  const activeShare = metrics.total_feeds
    ? ((metrics.active_feeds / metrics.total_feeds) * 100).toFixed(1)
    : "0.0";

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <span className="eyebrow">Key metrics</span>
          <h2 className="section-heading">Summary metrics</h2>
        </div>
        <p className="small-note">
          Last updated: {new Date(metrics.last_updated).toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total feeds"
          value={metrics.total_feeds.toLocaleString()}
          detail="Structured sources in the current catalog"
          icon={<RadioTower className="size-5" />}
        />
        <MetricCard
          label="Active feeds"
          value={metrics.active_feeds.toLocaleString()}
          detail={`${activeShare}% of total currently active`}
          icon={<ShieldCheck className="size-5" />}
        />
        <MetricCard
          label="Success rate"
          value={`${(metrics.validation_success_rate * 100).toFixed(1)}%`}
          detail="Validation success"
          icon={<Activity className="size-5" />}
          iconClassName="bg-[color:color-mix(in_oklab,var(--success-tone)_14%,var(--surface))] text-[color:var(--success-tone)]"
        />
        <MetricCard
          label="Average response"
          value={`${metrics.avg_response_time.toFixed(0)} ms`}
          detail="Latency across recent validation checks"
          icon={<CircleGauge className="size-5" />}
        />
      </div>

      <div className="surface-card-soft flex flex-wrap gap-4">
        <HealthChip label="Healthy" value={metrics.health_distribution.healthy} tone="success" />
        <HealthChip label="Moderate" value={metrics.health_distribution.moderate} tone="warning" />
        <HealthChip label="Unhealthy" value={metrics.health_distribution.unhealthy} tone="danger" />
      </div>
    </section>
  );
}

function HealthChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger";
}) {
  const toneClasses = {
    success:
      "border-[color:color-mix(in_oklab,var(--success-tone)_28%,var(--line))] bg-[color:color-mix(in_oklab,var(--success-tone)_14%,var(--surface))] text-[color:var(--success-tone)]",
    warning:
      "border-[color:color-mix(in_oklab,var(--warning-tone)_28%,var(--line))] bg-[color:color-mix(in_oklab,var(--warning-tone)_14%,var(--surface))] text-[color:var(--warning-tone)]",
    danger:
      "border-[color:color-mix(in_oklab,var(--danger-tone)_28%,var(--line))] bg-[color:color-mix(in_oklab,var(--danger-tone)_14%,var(--surface))] text-[color:var(--danger-tone)]",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClasses[tone]}`}>
      <p className="metric-label text-current!">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
