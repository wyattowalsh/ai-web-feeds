import type { ReactNode } from "react";
import { Activity, CircleGauge, RadioTower, ShieldCheck } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";

interface SummaryMetricValues {
  total_feeds: number;
  active_feeds: number;
  validation_success_rate: number;
  avg_response_time: number;
  health_distribution: {
    healthy: number;
    moderate: number;
    unhealthy: number;
  };
  last_updated?: string | null;
}

interface SummaryMetricsProps {
  metrics?: SummaryMetricValues | null;
  error?: string | null;
  // Existing callers still pass these. They do not load or invent catalog rows.
  dateRange?: string;
  topic?: string;
}

export function SummaryMetrics({ metrics = null, error = null }: SummaryMetricsProps) {
  const errorMessage = typeof error === "string" ? error.trim() : "";
  const summary = metrics;
  let state: "ready" | "empty" | "error" = "ready";
  if (errorMessage) state = "error";
  else if (!summary) state = "empty";

  const updatedLabel = summary ? formatLastUpdated(summary.last_updated) : null;

  let body: ReactNode;
  if (!summary) {
    body = errorMessage ? (
      <div
        role="alert"
        data-state="error"
        className="surface-card border-(--danger-tone)/40 text-(--ink)"
      >
        <p className="text-lg font-semibold">Error loading metrics</p>
        <p className="small-note mt-2">{errorMessage}</p>
      </div>
    ) : (
      <div
        role="status"
        data-state="empty"
        className="surface-card border-(--warning-tone)/40 text-(--ink)"
      >
        <p className="text-lg font-semibold">No data</p>
        <p className="small-note mt-2">No catalog metrics were provided.</p>
      </div>
    );
  } else {
    const activeShare =
      summary.total_feeds > 0
        ? ((summary.active_feeds / summary.total_feeds) * 100).toFixed(1)
        : "0.0";

    body = (
      <>
        {errorMessage ? (
          <div
            role="alert"
            data-state="error"
            className="surface-card border-(--danger-tone)/40 text-(--ink)"
          >
            <p className="text-lg font-semibold">Error loading metrics</p>
            <p className="small-note mt-2">{errorMessage}</p>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total feeds"
            value={summary.total_feeds.toLocaleString()}
            detail="Structured sources in the current catalog"
            icon={<RadioTower className="size-5" />}
          />
          <MetricCard
            label="Active feeds"
            value={summary.active_feeds.toLocaleString()}
            detail={`${activeShare}% of total currently active`}
            icon={<ShieldCheck className="size-5" />}
          />
          <MetricCard
            label="Success rate"
            value={`${(summary.validation_success_rate * 100).toFixed(1)}%`}
            detail="Validation success"
            icon={<Activity className="size-5" />}
            iconClassName="bg-[color:color-mix(in_oklab,var(--success-tone)_14%,var(--surface))] text-[color:var(--success-tone)]"
          />
          <MetricCard
            label="Average response"
            value={`${summary.avg_response_time.toFixed(0)} ms`}
            detail="Latency across recent validation checks"
            icon={<CircleGauge className="size-5" />}
          />
        </div>
        <div className="surface-card-soft flex flex-wrap gap-4">
          <HealthChip label="Healthy" value={summary.health_distribution.healthy} tone="success" />
          <HealthChip
            label="Moderate"
            value={summary.health_distribution.moderate}
            tone="warning"
          />
          <HealthChip
            label="Unhealthy"
            value={summary.health_distribution.unhealthy}
            tone="danger"
          />
        </div>
      </>
    );
  }

  return (
    <section
      aria-label="Summary metrics"
      className="space-y-5"
      data-state={state}
      data-demo="false"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <span className="eyebrow">Key metrics</span>
          <h2 className="section-heading">Summary metrics</h2>
        </div>
        {summary && updatedLabel ? (
          <p className="small-note">Last updated: {updatedLabel}</p>
        ) : null}
      </div>
      {body}
    </section>
  );
}

function formatLastUpdated(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString();
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
