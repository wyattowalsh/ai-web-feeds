import type { Metadata } from "next";
import { AnalyticsPageClient } from "@/components/analytics/analytics-page-client";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Dashboards - AI Web Feeds",
  description:
    "Catalog charts for summary, trending topics, health, and velocity. Real catalog rows only; the dashboard builder is not enabled.",
  path: "/analytics/dashboards",
});

export default function DashboardsPage() {
  return <AnalyticsPageClient />;
}
