"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Database, Download, RefreshCcw } from "lucide-react";
import { SummaryMetrics } from "@/components/analytics/summary-metrics";
import { TrendingTopicsChart } from "@/components/analytics/trending-topics-chart";
import { VelocityChart } from "@/components/analytics/velocity-chart";
import {
  HealthDistributionChart,
  type HealthDistribution,
} from "@/components/analytics/health-distribution-chart";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { CANONICAL_CATALOG_PATH } from "@/lib/reader-routes";

type AnalyticsPageClientProps = {
  backendConfigured?: boolean;
};

type SummaryMetricValues = {
  total_feeds: number;
  active_feeds: number;
  validation_success_rate: number;
  avg_response_time: number;
  health_distribution: HealthDistribution;
  last_updated?: string | null;
};

type TrendingTopic = {
  topic: string;
  feed_count: number;
  validation_frequency: number;
  avg_health_score: number;
};

type VelocityPoint = {
  date: string;
  count: number;
};

type ErrorBody = {
  error?: unknown;
  code?: unknown;
};

type SummaryLoad =
  | { status: "unavailable"; message: string }
  | {
      status: "ready";
      metrics: SummaryMetricValues | null;
      distribution: HealthDistribution | null;
      error: string | null;
    };

type TopicLoad = {
  topics: TrendingTopic[];
  error: string | null;
};

type VelocityLoad = {
  points: VelocityPoint[];
  error: string | null;
};

const unavailableCopy = "Analytics require the optional ai-web-feeds backend service.";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function textOrFallback(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return fallback;
}

function asErrorBody(value: unknown): ErrorBody | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as ErrorBody;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function distributionFrom(value: unknown): HealthDistribution | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const healthy = record.healthy;
  const moderate = record.moderate;
  const unhealthy = record.unhealthy;

  if (!isFiniteNumber(healthy) || !isFiniteNumber(moderate) || !isFiniteNumber(unhealthy)) {
    return null;
  }

  return { healthy, moderate, unhealthy };
}

// Catalog fields only. Missing counts, frequencies, and scores stay empty.
function summaryFromPayload(payload: unknown): {
  metrics: SummaryMetricValues | null;
  distribution: HealthDistribution | null;
} {
  if (!payload || typeof payload !== "object") {
    return { metrics: null, distribution: null };
  }

  const record = payload as Record<string, unknown>;
  const distribution = distributionFrom(record.health_distribution);
  const totalFeeds = record.total_feeds;
  const activeFeeds = record.active_feeds;
  const successRate = record.validation_success_rate;
  const responseTime = record.avg_response_time;

  if (
    !distribution ||
    !isFiniteNumber(totalFeeds) ||
    !isFiniteNumber(activeFeeds) ||
    !isFiniteNumber(successRate) ||
    !isFiniteNumber(responseTime)
  ) {
    return { metrics: null, distribution };
  }

  const metrics: SummaryMetricValues = {
    total_feeds: totalFeeds,
    active_feeds: activeFeeds,
    validation_success_rate: successRate,
    avg_response_time: responseTime,
    health_distribution: distribution,
  };

  if (typeof record.last_updated === "string" || record.last_updated === null) {
    metrics.last_updated = record.last_updated;
  }

  return { metrics, distribution };
}

function trendingTopicsFromPayload(payload: unknown): TrendingTopic[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const points = (payload as { points?: unknown }).points;
  if (!Array.isArray(points)) {
    return [];
  }

  const topics: TrendingTopic[] = [];

  for (const point of points) {
    if (!point || typeof point !== "object") {
      continue;
    }

    const record = point as Record<string, unknown>;
    if (typeof record.topic !== "string") {
      continue;
    }

    const topic = record.topic.trim();
    const feedCount = record.feed_count;
    const validationFrequency = record.validation_frequency;
    const avgHealthScore = record.avg_health_score;

    if (
      !topic ||
      !isFiniteNumber(feedCount) ||
      !isFiniteNumber(validationFrequency) ||
      !isFiniteNumber(avgHealthScore)
    ) {
      continue;
    }

    topics.push({
      topic,
      feed_count: feedCount,
      validation_frequency: validationFrequency,
      avg_health_score: avgHealthScore,
    });
  }

  return topics;
}

function velocityPointsFromPayload(payload: unknown): VelocityPoint[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const points = (payload as { points?: unknown }).points;
  if (!Array.isArray(points)) {
    return [];
  }

  const parsed: VelocityPoint[] = [];

  for (const point of points) {
    if (!point || typeof point !== "object") {
      continue;
    }

    const record = point as Record<string, unknown>;
    const count = record.count;
    if (typeof record.date !== "string" || record.date.trim() === "" || !isFiniteNumber(count)) {
      continue;
    }

    parsed.push({ date: record.date, count });
  }

  return parsed;
}

async function loadSummary(dateRange: string, topic: string | undefined): Promise<SummaryLoad> {
  try {
    const params = new URLSearchParams({ date_range: dateRange });
    if (topic) {
      params.set("topic", topic);
    }

    const response = await fetch(`/api/analytics/summary?${params.toString()}`, {
      cache: "no-store",
    });
    const payload = await readJson(response);

    if (!response.ok) {
      const errorBody = asErrorBody(payload);
      if (response.status === 503 || errorBody?.code === "FEATURE_UNAVAILABLE") {
        return {
          status: "unavailable",
          message: textOrFallback(errorBody?.error, unavailableCopy),
        };
      }

      return {
        status: "ready",
        metrics: null,
        distribution: null,
        error: textOrFallback(errorBody?.error, "Failed to load analytics"),
      };
    }

    const parsed = summaryFromPayload(payload);
    return {
      status: "ready",
      metrics: parsed.metrics,
      distribution: parsed.distribution,
      error: null,
    };
  } catch (error) {
    console.error("Analytics availability error:", error);
    return {
      status: "ready",
      metrics: null,
      distribution: null,
      error: "Failed to load analytics",
    };
  }
}

async function loadTrendingTopics(): Promise<TopicLoad> {
  try {
    const params = new URLSearchParams({ limit: "10" });
    const response = await fetch(`/api/analytics/trending?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = asErrorBody(await readJson(response));
      return {
        topics: [],
        error: textOrFallback(errorBody?.error, "Failed to load trending topics"),
      };
    }

    return { topics: trendingTopicsFromPayload(await readJson(response)), error: null };
  } catch (error) {
    console.error("Analytics trending error:", error);
    return { topics: [], error: "Failed to load trending topics" };
  }
}

async function loadVelocityPoints(dateRange: string): Promise<VelocityLoad> {
  try {
    const params = new URLSearchParams({
      date_range: dateRange,
      granularity: "daily",
    });
    const response = await fetch(`/api/analytics/velocity?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = asErrorBody(await readJson(response));
      return {
        points: [],
        error: textOrFallback(errorBody?.error, "Failed to load publication velocity"),
      };
    }

    return { points: velocityPointsFromPayload(await readJson(response)), error: null };
  } catch (error) {
    console.error("Analytics velocity error:", error);
    return { points: [], error: "Failed to load publication velocity" };
  }
}

export function AnalyticsPageClient({ backendConfigured = true }: AnalyticsPageClientProps) {
  const [dateRange, setDateRange] = useState("30d");
  const [topic, setTopic] = useState<string | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);
  const [backendStatus, setBackendStatus] = useState<"checking" | "available" | "unavailable">(
    backendConfigured ? "checking" : "unavailable",
  );
  const [backendMessage, setBackendMessage] = useState<string | null>(
    backendConfigured ? null : unavailableCopy,
  );
  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetricValues | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [healthDistribution, setHealthDistribution] = useState<HealthDistribution | null>(null);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [trendingError, setTrendingError] = useState<string | null>(null);
  const [velocityPoints, setVelocityPoints] = useState<VelocityPoint[]>([]);
  const [velocityError, setVelocityError] = useState<string | null>(null);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    if (!backendConfigured) {
      setBackendStatus("unavailable");
      setBackendMessage(unavailableCopy);
      setSummaryMetrics(null);
      setSummaryError(null);
      setHealthDistribution(null);
      setTrendingTopics([]);
      setTrendingError(null);
      setVelocityPoints([]);
      setVelocityError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setBackendStatus("checking");

      const summary = await loadSummary(dateRange, topic);
      if (cancelled) {
        return;
      }

      if (summary.status === "unavailable") {
        setBackendStatus("unavailable");
        setBackendMessage(summary.message);
        setSummaryMetrics(null);
        setSummaryError(null);
        setHealthDistribution(null);
        setTrendingTopics([]);
        setTrendingError(null);
        setVelocityPoints([]);
        setVelocityError(null);
        return;
      }

      const [trending, velocity] = await Promise.all([
        loadTrendingTopics(),
        loadVelocityPoints(dateRange),
      ]);
      if (cancelled) {
        return;
      }

      setSummaryMetrics(summary.metrics);
      setSummaryError(summary.error);
      setHealthDistribution(summary.distribution);
      setTrendingTopics(trending.topics);
      setTrendingError(trending.error);
      setVelocityPoints(velocity.points);
      setVelocityError(velocity.error);
      setBackendStatus("available");
      setBackendMessage(null);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [backendConfigured, dateRange, topic, refreshKey]);

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/analytics/export?date_range=${dateRange}`);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics_export_${dateRange}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export error:", error);
      alert("Failed to export analytics. Please try again.");
    }
  };

  return (
    <div className="page-wrap page-stack">
      <section className="surface-panel space-y-8">
        <div className="grid gap-8 md:gap-6 md:grid-cols-[1fr_0.9fr] lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-5">
            <span className="eyebrow">
              <Database className="size-3.5" />
              Analytics overview
            </span>
            <div className="space-y-4">
              <h1 className="hero-title max-w-4xl">
                Secondary analytics for validation and topic momentum.
              </h1>
              <p className="hero-copy max-w-2xl">
                The reader and catalog stay primary. This route is for deployments that also have
                the optional backend service available.
              </p>
            </div>
          </div>

          <div className="surface-card-soft space-y-4">
            <p className="metric-label">When this route is active</p>
            <div className="grid gap-3 text-sm text-(--ink)">
              <div className="flex items-start gap-3">
                <RefreshCcw className="mt-0.5 size-4 text-(--brand-strong)" />
                Validation activity over time
              </div>
              <div className="flex items-start gap-3">
                <ArrowUpRight className="mt-0.5 size-4 text-(--brand-strong)" />
                Topic momentum and feed health distribution
              </div>
              <div className="flex items-start gap-3">
                <Download className="mt-0.5 size-4 text-(--brand-strong)" />
                Exportable snapshots for downstream analysis
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/docs/features/analytics"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Analytics docs
              </Link>
              <a
                href="/api/analytics/summary"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "ghost" }))}
              >
                Summary API
              </a>
            </div>
          </div>
        </div>

        {backendStatus === "unavailable" ? (
          <EmptyState
            icon={Database}
            title="Analytics backend unavailable"
            description={backendMessage || unavailableCopy}
            tips={[
              "The reader and catalog stay primary without the optional backend service.",
              "Enable live analytics only when this secondary route is needed.",
            ]}
          >
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href={CANONICAL_CATALOG_PATH}
                className={cn(buttonVariants({ variant: "secondary" }))}
              >
                Open catalog
              </Link>
              <Link
                href="/docs/guides/deployment"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Deployment setup
              </Link>
            </div>
          </EmptyState>
        ) : null}

        {backendStatus === "checking" ? (
          <div className="surface-card">
            <p className="metric-label">Checking backend availability</p>
            <p className="small-note mt-2">
              Verifying whether the optional analytics backend is configured for this deployment.
            </p>
          </div>
        ) : null}

        {backendStatus === "available" ? (
          <>
            <AnalyticsFilters
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              topic={topic}
              onTopicChange={setTopic}
              onRefresh={handleRefresh}
              onExport={handleExport}
            />

            <SummaryMetrics
              key={`summary-${refreshKey}`}
              metrics={summaryMetrics}
              error={summaryError}
            />

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <TrendingTopicsChart
                key={`trending-${refreshKey}`}
                topics={trendingTopics}
                error={trendingError}
              />
              <HealthDistributionChart
                key={`health-${refreshKey}`}
                distribution={healthDistribution}
              />
            </div>

            <VelocityChart
              key={`velocity-${refreshKey}`}
              data_points={velocityPoints}
              error={velocityError}
            />

            <div className="surface-card-soft space-y-4">
              <div className="space-y-2">
                <p className="metric-label">Methodology</p>
                <h2 className="text-title-medium">How the dashboard frames the catalog</h2>
              </div>
              <p className="small-note">
                Analytics are calculated based on feed validation frequency (used as a proxy for
                publication activity). Health scores categorize feeds as: <strong>Healthy</strong>{" "}
                (≥0.8), <strong>Moderate</strong> (0.5-0.8), or <strong>Unhealthy</strong>{" "}
                (&lt;0.5). Trending topics are ranked by validation frequency weighted by feed
                health scores. Data is cached for performance: static metrics (1 hour), dynamic
                metrics (5 minutes).
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/docs/features/analytics"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Documentation
                </Link>
                <a
                  href="/api/analytics/summary"
                  className={cn(buttonVariants({ variant: "ghost" }))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  API endpoint
                </a>
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
