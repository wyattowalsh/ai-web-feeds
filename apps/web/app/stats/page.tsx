import type { Metadata } from "next";
import { Activity, Gauge, ShieldCheck, TimerReset, TriangleAlert } from "lucide-react";
import { getValidationStats } from "@/lib/validation-stats";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Stats - AIWebFeeds",
  description: "View feed validation coverage, response times, and collection health.",
  openGraph: {
    title: "Stats - AIWebFeeds",
    description: "View feed validation coverage, response times, and collection health.",
  },
};

export default async function StatsPage() {
  const stats = await getValidationStats();
  const toPercent = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);
  const renderMetric = (value: number | null, formatter: (metric: number) => string) =>
    value === null ? "N/A" : formatter(value);

  return (
    <div className="page-wrap page-stack">
      <section className="surface-panel space-y-8">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-5">
            <span className="eyebrow">
              <Gauge className="size-3.5" />
              Validation statistics
            </span>
            <div className="space-y-4">
              <h1 className="hero-title max-w-4xl">
                Track collection health instead of guessing at it.
              </h1>
              <p className="hero-copy max-w-2xl">
                These metrics surface validation coverage, response-time quality, and health-score
                distribution so you can see where the catalog is strong and where maintenance work
                is needed.
              </p>
            </div>
          </div>

          <div className="surface-card-soft space-y-4">
            <p className="metric-label">Refresh cadence</p>
            <p className="small-note">
              Stats refresh every five minutes when validation snapshots are available to the web
              runtime.
            </p>
            <div className="rounded-3xl border border-(--line) bg-(--surface) p-4">
              <p className="text-sm font-semibold text-(--ink)">Last validation run</p>
              <p className="small-note mt-1">{stats.last_validation_run || "Unavailable"}</p>
            </div>
          </div>
        </div>

        {!stats.validation_data_available && (
          <div className="surface-card flex gap-4 border-[color-mix(in_oklab,var(--danger-tone)_25%,var(--line))] bg-[color-mix(in_oklab,var(--danger-tone)_9%,var(--surface))]">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--danger-tone)_14%,var(--surface))] text-(--danger-tone)">
              <TriangleAlert className="size-5" />
            </span>
            <div>
              <p className="font-semibold text-(--ink)">
                Validation history is not currently available.
              </p>
              <p className="mt-1 text-sm text-(--ink-muted)">
                The web app can load collection totals from repository data files, but the current
                runtime does not have a validation snapshot to populate success rate, response time,
                and health metrics.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="surface-card flex items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="metric-label">Total feeds</p>
              <p className="metric-value">{stats.total_feeds}</p>
              <p className="small-note">In collection</p>
            </div>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
              <Activity className="size-5" />
            </span>
          </div>

          <div className="surface-card flex items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="metric-label">Success rate</p>
              <p className="metric-value">
                {renderMetric(stats.success_rate, (value) => `${value.toFixed(1)}%`)}
              </p>
              <p className="small-note">
                {stats.validation_data_available
                  ? `${stats.success_count} / ${stats.validated_feeds} validated`
                  : "Validation snapshot unavailable"}
              </p>
            </div>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
              <ShieldCheck className="size-5" />
            </span>
          </div>

          <div className="surface-card flex items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="metric-label">Avg response time</p>
              <p className="metric-value">
                {renderMetric(stats.avg_response_time_ms, (value) => String(value))}
                <span className="ml-1 text-lg">ms</span>
              </p>
              <p className="small-note">
                {stats.validation_data_available
                  ? "HTTP fetch time"
                  : "Validation snapshot unavailable"}
              </p>
            </div>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
              <TimerReset className="size-5" />
            </span>
          </div>

          <div className="surface-card flex items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="metric-label">Health score</p>
              <p className="metric-value">
                {renderMetric(stats.avg_health_score, (value) => value.toFixed(2))}
              </p>
              <p className="small-note">Average on a 0.0-1.0 scale</p>
            </div>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
              <Gauge className="size-5" />
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="surface-card">
            <h2 className="text-xl font-semibold text-(--ink)">Validation Status</h2>
            {stats.validation_data_available ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-500"></div>
                    <span>Successful</span>
                  </div>
                  <div className="text-lg font-semibold text-(--ink)">{stats.success_count}</div>
                </div>
                <div className="h-2 w-full rounded-full bg-(--surface-muted)">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${toPercent(stats.success_count, stats.validated_feeds)}%`,
                    }}
                  ></div>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-500"></div>
                    <span>Failed</span>
                  </div>
                  <div className="text-lg font-semibold text-(--ink)">{stats.failure_count}</div>
                </div>
                <div className="h-2 w-full rounded-full bg-(--surface-muted)">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{
                      width: `${toPercent(stats.failure_count, stats.validated_feeds)}%`,
                    }}
                  ></div>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                    <span>Not Validated</span>
                  </div>
                  <div className="text-lg font-semibold text-(--ink)">
                    {stats.total_feeds - stats.validated_feeds}
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-(--surface-muted)">
                  <div
                    className="bg-gray-400 h-2 rounded-full"
                    style={{
                      width: `${toPercent(
                        stats.total_feeds - stats.validated_feeds,
                        stats.total_feeds,
                      )}%`,
                    }}
                  ></div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-(--ink-muted)">
                No validation breakdown is available until validation results are generated and made
                accessible to the web runtime.
              </p>
            )}
          </div>

          <div className="surface-card">
            <h2 className="text-xl font-semibold text-(--ink)">Health Distribution</h2>
            {stats.validation_data_available ? (
              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Healthy (≥0.8)</span>
                    <span className="text-sm font-semibold text-(--ink)">
                      {stats.healthy_feeds} feeds
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-(--surface-muted)">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${toPercent(stats.healthy_feeds, stats.total_feeds)}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div className="border-t border-(--line) pt-4">
                  <p className="text-sm text-(--ink-muted)">
                    Health score is calculated based on success rate (80%) and response time (20%).
                    Feeds with scores ≥0.8 are considered healthy.
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-(--ink-muted)">
                Health distribution depends on stored validation history and cannot be inferred from
                the feed catalog alone.
              </p>
            )}
          </div>
        </div>

        <div className="surface-card">
          <h2 className="text-xl font-semibold text-(--ink)">Run Validation</h2>
          <p className="mb-4 mt-3 text-sm text-(--ink-muted)">
            To validate all feeds and update these metrics, run:
          </p>
          <pre className="overflow-x-auto rounded-3xl bg-[rgb(17,24,39)] p-4 text-[rgb(243,244,246)]">
            <code>uv run ai-web-feeds validate http</code>
          </pre>
          <p className="mt-3 text-xs text-(--ink-muted)">
            This will check HTTP accessibility, parse feeds, and store validation results in the
            database.
          </p>
        </div>

        <div className="text-center text-sm text-(--ink-muted)">
          <p>Stats refreshed every 5 minutes.</p>
        </div>
      </section>
    </div>
  );
}
