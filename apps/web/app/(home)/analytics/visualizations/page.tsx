import type { Metadata } from "next";
import { Suspense } from "react";
import { ChartBuilder } from "@/components/visualizations/ChartBuilder";
import { HubPage } from "@/components/hub";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Visualizations - AI Web Feeds",
  description:
    "Create and manage custom visualizations for analytics data from feeds, topics, and articles.",
  path: "/analytics/visualizations",
});

export default function VisualizationsPage() {
  return (
    <div className="page-wrap page-stack">
      <HubPage
        eyebrow="Analytics"
        title="Visualizations"
        description="Build custom charts from your feed, topic, and article data. Configure data sources, chart types, and styling."
      >
        <Suspense
          fallback={
            <div className="h-96 flex items-center justify-center text-muted-foreground">
              Loading visualization builder...
            </div>
          }
        >
          <ChartBuilder />
        </Suspense>
      </HubPage>
    </div>
  );
}
