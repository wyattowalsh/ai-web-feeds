import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Database, Gauge, ShieldCheck } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { getRequestNonce } from "@/lib/nonce";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Progress } from "@/components/ui/progress";
import { getFeedStats, loadFeedCatalog } from "@/lib/feeds";
import { createPageMetadata } from "@/lib/seo";
import { collectionPageJsonLd } from "@/lib/structured-data";
import { getValidationStats } from "@/lib/validation-stats";

export const revalidate = 300;

export const metadata: Metadata = createPageMetadata({
  title: "Dashboard - AI Web Feeds",
  description: "A compact health and catalog dashboard for the AI Web Feeds reader.",
  path: "/dashboard",
});

function formatPercent(value: number | null): string {
  return value === null ? "N/A" : `${value.toFixed(1)}%`;
}

function formatNumber(value: number | null): string {
  return value === null ? "N/A" : new Intl.NumberFormat("en-US").format(value);
}

export default async function DashboardPage() {
  const nonce = await getRequestNonce();
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
      <JsonLd
        nonce={nonce}
        data={collectionPageJsonLd({
          name: "AI Web Feeds Dashboard",
          description: "Catalog health and coverage dashboard for AI Web Feeds.",
          url: "/dashboard",
          items: [
            {
              name: "Source coverage",
              url: "/sources",
              description: `${feedStats.total} tracked sources across ${feedStats.topicCount} topics.`,
            },
            {
              name: "Reader",
              url: "/reader",
              description: "Read recent posts from the tracked source catalog.",
            },
          ],
        })}
      />
      <section className="flex flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="flex flex-col gap-5">
            <div>
              <span className="eyebrow">
                <Gauge className="size-3.5" />
                Dashboard
              </span>
            </div>
            <div className="flex flex-col gap-4">
              <h1 className="max-w-3xl text-3xl font-semibold text-foreground sm:text-4xl">
                Catalog health without the control room.
              </h1>
              <p className="small-note max-w-2xl">
                A compact operational view for source coverage, validation, and catalog shape.
              </p>
            </div>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-3 lg:w-[30rem]">
            <Link
              href="/reader"
              className="rounded-lg border border-border bg-card p-3 font-semibold shadow-sm transition duration-150 hover:bg-muted"
            >
              Reader
              <span className="mt-1 block text-xs font-normal text-muted-foreground">/reader</span>
            </Link>
            <Link
              href="/sources"
              className="rounded-lg border border-border bg-card p-3 font-semibold shadow-sm transition duration-150 hover:bg-muted"
            >
              Sources
              <span className="mt-1 block text-xs font-normal text-muted-foreground">/sources</span>
            </Link>
            <Link
              href="/topics"
              className="rounded-lg border border-border bg-card p-3 font-semibold shadow-sm transition duration-150 hover:bg-muted"
            >
              Topics
              <span className="mt-1 block text-xs font-normal text-muted-foreground">/topics</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Sources",
              value: formatNumber(feedStats.total),
              note: `${formatNumber(activeFeeds)} active in the reader catalog`,
              icon: Activity,
            },
            {
              label: "Verified",
              value: verifiedLabel,
              note: "Catalog trust metadata",
              icon: ShieldCheck,
            },
            {
              label: "Topics",
              value: formatNumber(feedStats.topicCount),
              note: `${formatNumber(feedStats.sourceTypeCount)} source types`,
              icon: Database,
            },
            {
              label: "Validation",
              value: formatPercent(validationStats.success_rate),
              note: validationLabel,
              icon: Gauge,
            },
          ].map(({ label, value, note, icon: Icon }) => (
            <MetricCard
              key={label}
              label={label}
              value={value}
              detail={note}
              icon={<Icon className="size-5" />}
            />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <p className="metric-label">Source mix</p>
              <CardTitle className="text-2xl">What the reader draws from</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {sourceTypes.map(([type, count]) => (
                <div key={type} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-semibold text-foreground">{type}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <Progress
                    value={Math.max(4, (count / feedStats.total) * 100)}
                    aria-label={`${type} source share`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="metric-label">Operations</p>
              <CardTitle className="text-2xl">Keep management out of the reader</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm leading-6 text-muted-foreground">
              <p>
                Use the web app to read, browse, and monitor. Use the CLI for repeatable catalog
                operations.
              </p>
              <div className="rounded-lg border border-border bg-muted p-4 font-mono text-xs text-foreground">
                <div>uv run ai-web-feeds opml --help</div>
                <div>uv run ai-web-feeds analytics --help</div>
                <div>uv run ai-web-feeds corpus --help</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
