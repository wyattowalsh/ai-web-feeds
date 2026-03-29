"use client";

import {
  startTransition,
  useEffect,
  useState,
} from "react";
import { Activity, AlertTriangle, Clock3, RefreshCcw, Route, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";

type AdminAuditEvent = {
  timestamp: string;
  action: string;
  outcome: "success" | "failure";
  detail: string | null;
};

type ApiTelemetryEvent = {
  requestId: string;
  timestamp: string;
  routeKey: string;
  method: string;
  statusCode: number;
  durationMs: number;
  errorMessage: string | null;
};

type TelemetryRouteSummary = {
  routeKey: string;
  requestCount: number;
  errorCount: number;
  errorRate: number;
  averageDurationMs: number;
  p95DurationMs: number;
  lastSeenAt: string;
};

type TelemetrySummary = {
  windowHours: number;
  requestCount: number;
  errorCount: number;
  errorRate: number;
  averageDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  routeCount: number;
  lastIngestedAt: string | null;
  routeBreakdown: TelemetryRouteSummary[];
  recentErrors: ApiTelemetryEvent[];
  auditEvents: AdminAuditEvent[];
};

type EventsResponse = {
  events: ApiTelemetryEvent[];
  audit: AdminAuditEvent[];
};

async function loadTelemetryData(): Promise<[TelemetrySummary, EventsResponse]> {
  const [summaryResponse, eventsResponse] = await Promise.all([
    fetch("/api/admin/telemetry/summary?window_hours=24", { cache: "no-store" }),
    fetch("/api/admin/telemetry/events?window_hours=24&limit=25", { cache: "no-store" }),
  ]);

  if (!summaryResponse.ok || !eventsResponse.ok) {
    throw new Error("Failed to load telemetry data");
  }

  return (await Promise.all([summaryResponse.json(), eventsResponse.json()])) as [
    TelemetrySummary,
    EventsResponse,
  ];
}

function formatRelativeTimestamp(timestamp: string): string {
  const elapsedMs = Date.now() - Date.parse(timestamp);

  if (elapsedMs < 60_000) {
    return `${Math.max(1, Math.round(elapsedMs / 1000))}s ago`;
  }

  if (elapsedMs < 3_600_000) {
    return `${Math.round(elapsedMs / 60_000)}m ago`;
  }

  return `${Math.round(elapsedMs / 3_600_000)}h ago`;
}

export function AdminDashboard() {
  const [summary, setSummary] = useState<TelemetrySummary | null>(null);
  const [events, setEvents] = useState<EventsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshData = async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const [summaryPayload, eventsPayload] = await loadTelemetryData();

      setSummary(summaryPayload);
      setEvents(eventsPayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load telemetry data");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const triggerRefresh = () => {
      startTransition(() => {
        void refreshData();
      });
    };

    triggerRefresh();

    const intervalId = window.setInterval(triggerRefresh, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="metric-label">API observability</p>
          <p className="small-note">
            Route-level telemetry is captured directly from App Router handlers and stored for protected admin review.
          </p>
        </div>
        <Button variant="outline" onClick={() => startTransition(() => void refreshData())} disabled={isRefreshing}>
          <RefreshCcw className="size-4" />
          {isRefreshing ? "Refreshing" : "Refresh"}
        </Button>
      </div>

      {error ? <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Requests"
          value={summary ? String(summary.requestCount) : "--"}
          detail="Last 24 hours across instrumented routes"
          icon={<Activity className="size-5" />}
          surface="soft"
        />
        <MetricCard
          label="Error rate"
          value={summary ? `${(summary.errorRate * 100).toFixed(1)}%` : "--"}
          detail={summary ? `${summary.errorCount} server-side failures observed` : "Loading error trend"}
          icon={<AlertTriangle className="size-5" />}
          surface="soft"
          iconClassName="bg-[color:color-mix(in_oklab,var(--warning-tone)_14%,var(--surface))] text-[color:var(--warning-tone)]"
        />
        <MetricCard
          label="p95 latency"
          value={summary ? `${summary.p95DurationMs.toFixed(0)} ms` : "--"}
          detail={summary ? `Median ${summary.p50DurationMs.toFixed(0)} ms` : "Loading latency"}
          icon={<Clock3 className="size-5" />}
          surface="soft"
        />
        <MetricCard
          label="Routes"
          value={summary ? String(summary.routeCount) : "--"}
          detail={summary?.lastIngestedAt ? `Last event ${formatRelativeTimestamp(summary.lastIngestedAt)}` : "No telemetry ingested yet"}
          icon={<Route className="size-5" />}
          surface="soft"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="surface-panel space-y-5">
          <div className="space-y-1">
            <p className="metric-label">Hot routes</p>
            <h2 className="text-title-medium">Top instrumented endpoints</h2>
          </div>

          <div className="space-y-3">
            {summary?.routeBreakdown.length ? (
              summary.routeBreakdown.map((route) => (
                <div key={route.routeKey} className="rounded-2xl border border-(--line) bg-(--surface) p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-(--ink)">{route.routeKey}</p>
                      <p className="small-note">Last seen {formatRelativeTimestamp(route.lastSeenAt)}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-right text-sm">
                      <div>
                        <p className="metric-label">Requests</p>
                        <p className="font-semibold text-(--ink)">{route.requestCount}</p>
                      </div>
                      <div>
                        <p className="metric-label">Errors</p>
                        <p className="font-semibold text-(--ink)">{route.errorCount}</p>
                      </div>
                      <div>
                        <p className="metric-label">p95</p>
                        <p className="font-semibold text-(--ink)">{route.p95DurationMs.toFixed(0)} ms</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="small-note">No route telemetry has been ingested yet.</p>
            )}
          </div>
        </section>

        <section className="surface-panel space-y-5">
          <div className="space-y-1">
            <p className="metric-label">Admin audit</p>
            <h2 className="text-title-medium">Recent privileged actions</h2>
          </div>

          <div className="space-y-3">
            {summary?.auditEvents.length ? (
              summary.auditEvents.map((event) => (
                <div key={`${event.timestamp}-${event.action}`} className="rounded-2xl border border-(--line) bg-(--surface) p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-(--ink)">{event.action}</p>
                      <p className="small-note">{event.detail ?? "No additional detail"}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium text-(--ink)">{event.outcome}</p>
                      <p className="small-note">{formatRelativeTimestamp(event.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="small-note">No admin audit activity yet.</p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="surface-panel space-y-5">
          <div className="space-y-1">
            <p className="metric-label">Server failures</p>
            <h2 className="text-title-medium">Recent 5xx responses</h2>
          </div>

          <div className="space-y-3">
            {summary?.recentErrors.length ? (
              summary.recentErrors.map((event) => (
                <div key={event.requestId} className="rounded-2xl border border-red-200 bg-red-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-red-900">{event.routeKey}</p>
                      <p className="text-sm text-red-700">{event.errorMessage ?? `HTTP ${event.statusCode}`}</p>
                    </div>
                    <div className="text-right text-sm text-red-800">
                      <p>{event.durationMs.toFixed(0)} ms</p>
                      <p>{formatRelativeTimestamp(event.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="small-note">No 5xx responses have been recorded in the current window.</p>
            )}
          </div>
        </section>

        <section className="surface-panel space-y-5">
          <div className="space-y-1">
            <p className="metric-label">Request stream</p>
            <h2 className="text-title-medium">Latest route activity</h2>
          </div>

          <div className="space-y-3">
            {events?.events.length ? (
              events.events.map((event) => (
                <div key={event.requestId} className="rounded-2xl border border-(--line) bg-(--surface) p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-(--ink)">{event.routeKey}</p>
                      <p className="small-note">
                        {event.method} · HTTP {event.statusCode} · {event.requestId.slice(0, 8)}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium text-(--ink)">{event.durationMs.toFixed(0)} ms</p>
                      <p className="small-note">{formatRelativeTimestamp(event.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="small-note">Recent request telemetry will appear here once instrumented routes are hit.</p>
            )}
          </div>
        </section>
      </div>

      <div className="surface-card-soft flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-4 text-(--brand-strong)" />
        <p className="small-note">
          Telemetry captures route key, status, latency, request identifiers, cache hints, and redacted failure context. Admin passwords remain server-only and are never written into telemetry records.
        </p>
      </div>
    </div>
  );
}