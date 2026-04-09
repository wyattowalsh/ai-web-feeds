"use client";

import { useEffect, useState } from "react";
import { Activity, CalendarClock, Newspaper, RadioTower } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";

interface SummaryMetricsPayload {
  total_sources: number;
  active_sources: number;
  posts_last_24h: number;
  posts_last_7d: number;
  topic_count: number;
  source_type_distribution: Array<{ source_type: string; count: number }>;
  scan_summary: {
    matching_sources: number;
    scanned_sources: number;
    scan_limit: number;
    per_source_limit: number;
    truncated: boolean;
  };
  last_updated: string;
}

function formatSourceTypeLabel(value: string): string {
  return value
    .split(/[_-]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const upper = segment.toUpperCase();
      if (upper === "AI" || upper === "ML" || upper === "LLM" || upper === "RSS") {
        return upper;
      }

      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(" ");
}

export function SummaryMetrics({
  dateRange = "30d",
  topic,
}: {
  dateRange?: string;
  topic?: string;
}) {
  const [metrics, setMetrics] = useState<SummaryMetricsPayload | null>(null);
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

        const data = (await response.json()) as SummaryMetricsPayload;
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    void fetchMetrics();
  }, [dateRange, topic]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="surface-card space-y-4">
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

  const activeShare = metrics.total_sources
    ? ((metrics.active_sources / metrics.total_sources) * 100).toFixed(1)
    : "0.0";
  const scanSummary = metrics.scan_summary;
  const scanCoverageMessage = scanSummary.truncated
    ? `Scanning ${scanSummary.scanned_sources} of ${scanSummary.matching_sources} matching active sources, up to ${scanSummary.per_source_limit} recent posts per source.`
    : `Scanning all ${scanSummary.scanned_sources} matching active sources, up to ${scanSummary.per_source_limit} recent posts per source.`;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <span className="eyebrow">Key metrics</span>
          <h2 className="section-heading">Catalog and activity summary</h2>
        </div>
        <p className="small-note">
          Last updated: {new Date(metrics.last_updated).toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total sources"
          value={metrics.total_sources.toLocaleString()}
          detail={`${metrics.topic_count.toLocaleString()} distinct topics in catalog`}
          icon={<RadioTower className="size-5" />}
        />
        <MetricCard
          label="Active sources"
          value={metrics.active_sources.toLocaleString()}
          detail={`${activeShare}% of the filtered catalog`}
          icon={<Activity className="size-5" />}
        />
        <MetricCard
          label="Posts in 24h"
          value={metrics.posts_last_24h.toLocaleString()}
          detail="Recent post count inside the live analytics window"
          icon={<CalendarClock className="size-5" />}
        />
        <MetricCard
          label="Posts in 7d"
          value={metrics.posts_last_7d.toLocaleString()}
          detail="Seven-day activity in the live analytics window"
          icon={<Newspaper className="size-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="surface-card-soft space-y-3">
          <div className="space-y-1">
            <p className="metric-label">Scan coverage</p>
            <h3 className="text-lg font-semibold text-(--ink)">Live analytics window</h3>
          </div>
          <p className="text-sm text-(--ink-muted)">{scanCoverageMessage}</p>
          <p className="small-note">
            Scan limit {scanSummary.scan_limit} sources. Freshness, trending, and velocity panels
            reflect this live scan window rather than the entire catalog history.
          </p>
        </div>

        <div className="surface-card-soft space-y-3">
          <div className="space-y-1">
            <p className="metric-label">Source type mix</p>
            <h3 className="text-lg font-semibold text-(--ink)">Filtered catalog distribution</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {metrics.source_type_distribution.slice(0, 6).map((entry) => (
              <div
                key={entry.source_type}
                className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--ink-muted)]">
                  {formatSourceTypeLabel(entry.source_type)}
                </p>
                <p className="mt-2 text-xl font-semibold text-[color:var(--ink)]">{entry.count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
