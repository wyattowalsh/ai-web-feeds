"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Database, Download, RefreshCcw } from "lucide-react";
import { FreshestSourcesPanel } from "@/components/analytics/freshest-sources-panel";
import { SummaryMetrics } from "@/components/analytics/summary-metrics";
import { TrendingTopicsChart } from "@/components/analytics/trending-topics-chart";
import { VelocityChart } from "@/components/analytics/velocity-chart";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState("30d");
  const [topic, setTopic] = useState<string | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ date_range: dateRange });
      if (topic) {
        params.set("topic", topic);
      }

      const response = await fetch(`/api/analytics/export?${params.toString()}`);
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
                Feed health, validation cadence, and topic momentum.
              </h1>
              <p className="hero-copy max-w-2xl">
                Local analytics now read directly from the shipped catalog plus recent feed fetches
                so the default deployment can show what is publishing, which topics dominate, and
                which sources are freshest without requiring a separate backend. Coverage notes now
                make the live scan window explicit instead of implying exhaustive article history.
              </p>
            </div>
          </div>

          <div className="surface-card-soft space-y-4">
            <p className="metric-label">What you can inspect here</p>
            <div className="grid gap-3 text-sm text-(--ink)">
              <div className="flex items-start gap-3">
                <RefreshCcw className="mt-0.5 size-4 text-(--brand-strong)" />
                Recent publication velocity over time
              </div>
              <div className="flex items-start gap-3">
                <ArrowUpRight className="mt-0.5 size-4 text-(--brand-strong)" />
                Topic momentum and freshest publishing sources
              </div>
              <div className="flex items-start gap-3">
                <Download className="mt-0.5 size-4 text-(--brand-strong)" />
                Exportable CSV snapshots for downstream analysis
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

        <AnalyticsFilters
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          topic={topic}
          onTopicChange={setTopic}
          onRefresh={handleRefresh}
          onExport={handleExport}
        />

        <SummaryMetrics key={`summary-${refreshKey}`} dateRange={dateRange} topic={topic} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <TrendingTopicsChart
            key={`trending-${refreshKey}`}
            dateRange={dateRange}
            topic={topic}
            limit={10}
          />
          <FreshestSourcesPanel key={`fresh-${refreshKey}`} dateRange={dateRange} topic={topic} />
        </div>

        <VelocityChart
          key={`velocity-${refreshKey}`}
          dateRange={dateRange}
          topic={topic}
          granularity="daily"
        />

        <div className="surface-card-soft space-y-4">
          <div className="space-y-2">
            <p className="metric-label">Methodology</p>
            <h2 className="text-title-medium">How the dashboard frames the catalog</h2>
          </div>
          <p className="small-note">
            Analytics are built from the local feed catalog plus recent post timestamps fetched
            through the aggregate feed loader. Topic distribution comes from source metadata, while
            trending, freshness, and velocity views use recent publication timestamps observed in
            the selected live scan window. Data is cached briefly so repeated dashboard views stay
            fast.
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
      </section>
    </div>
  );
}
