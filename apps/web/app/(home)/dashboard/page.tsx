import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Database,
  FileJson2,
  Gauge,
  RadioTower,
  ShieldCheck,
} from "lucide-react";
import { getFeedStats, loadFeedCatalog } from "@/lib/feeds";
import { getValidationStats } from "@/lib/validation-stats";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Dashboard - AI Web Feeds",
  description: "A compact health and catalog dashboard for the AI Web Feeds reader.",
};

function formatPercent(value: number | null): string {
  return value === null ? "N/A" : `${value.toFixed(1)}%`;
}

function formatNumber(value: number | null): string {
  return value === null ? "N/A" : new Intl.NumberFormat("en-US").format(value);
}

export default async function DashboardPage() {
  const feedsData = loadFeedCatalog();
  const feedStats = getFeedStats(feedsData.sources);
  const validationStats = await getValidationStats();
  const sourceTypes = Object.entries(feedStats.byType)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8);

  const activeFeeds =
    feedStats.hasActivityMetadata && feedStats.active > 0 ? feedStats.active : feedStats.total;
  const verifiedLabel = feedStats.hasVerificationMetadata
    ? String(feedStats.verified)
    : "Not tracked";
  const validationLabel = validationStats.validation_data_available
    ? `${validationStats.success_count} / ${validationStats.validated_feeds}`
    : "Snapshot unavailable";

  return (
    <div className="page-wrap page-stack">
      <section className="surface-panel space-y-8">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="space-y-5">
            <span className="eyebrow">
              <Gauge className="size-3.5" />
              Dashboard
            </span>
            <div className="space-y-4">
              <h1 className="text-title-large max-w-3xl">
                Catalog health without the control room.
              </h1>
              <p className="hero-copy max-w-2xl">
                The public app has two jobs: read on the homepage and check the collection here.
                OPML generation, enrichment, validation, and analytics exports stay in the repo and
                CLI workflows.
              </p>
            </div>
          </div>

          <div className="surface-card-soft space-y-4">
            <p className="metric-label">Primary surfaces</p>
            <div className="grid gap-3 text-sm text-(--ink)">
              <Link href="/" className="flex items-center gap-3 font-semibold">
                <RadioTower className="size-4 text-(--brand-strong)" />
                Reader at /
              </Link>
              <Link href="/dashboard" className="flex items-center gap-3 font-semibold">
                <BarChart3 className="size-4 text-(--brand-strong)" />
                Dashboard at /dashboard
              </Link>
              <Link href="/docs/development/cli" className="flex items-center gap-3 font-semibold">
                <FileJson2 className="size-4 text-(--brand-strong)" />
                OPML and analytics in CLI docs
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="surface-card space-y-3">
            <Activity className="size-5 text-(--brand-strong)" />
            <p className="metric-label">Sources</p>
            <p className="metric-value">{formatNumber(feedStats.total)}</p>
            <p className="small-note">{formatNumber(activeFeeds)} active in the reader catalog</p>
          </div>
          <div className="surface-card space-y-3">
            <ShieldCheck className="size-5 text-(--brand-strong)" />
            <p className="metric-label">Verified</p>
            <p className="metric-value">{verifiedLabel}</p>
            <p className="small-note">Verification is catalog metadata, not reader chrome</p>
          </div>
          <div className="surface-card space-y-3">
            <Database className="size-5 text-(--brand-strong)" />
            <p className="metric-label">Topics</p>
            <p className="metric-value">{formatNumber(feedStats.topicCount)}</p>
            <p className="small-note">{formatNumber(feedStats.sourceTypeCount)} source types</p>
          </div>
          <div className="surface-card space-y-3">
            <Gauge className="size-5 text-(--brand-strong)" />
            <p className="metric-label">Validation</p>
            <p className="metric-value">{formatPercent(validationStats.success_rate)}</p>
            <p className="small-note">{validationLabel}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="surface-card space-y-5">
            <div>
              <p className="metric-label">Source mix</p>
              <h2 className="mt-2 text-title-medium">What the reader is drawing from</h2>
            </div>
            <div className="space-y-3">
              {sourceTypes.map(([type, count]) => (
                <div key={type} className="space-y-2">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-semibold text-(--ink)">{type}</span>
                    <span className="text-(--ink-muted)">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-(--surface-muted)">
                    <div
                      className="h-2 rounded-full bg-(--brand)"
                      style={{ width: `${Math.max(4, (count / feedStats.total) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-card space-y-5">
            <div>
              <p className="metric-label">Operational boundary</p>
              <h2 className="mt-2 text-title-medium">Keep management in the repo</h2>
            </div>
            <div className="space-y-4 text-sm leading-6 text-(--ink-muted)">
              <p>
                Use the web app to read and monitor. Use the repository commands to change data,
                generate OPML, rebuild the article corpus, and export analytics artifacts.
              </p>
              <div className="rounded-3xl border border-(--line) bg-(--surface-muted) p-4 font-mono text-xs text-(--ink)">
                <div>uv run ai-web-feeds opml --help</div>
                <div>uv run ai-web-feeds analytics --help</div>
                <div>uv run ai-web-feeds corpus --help</div>
              </div>
              <p>
                That split keeps the browser focused on reading while preserving the project tools
                for repeatable catalog operations.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
