import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardBuilder } from "@/components/visualizations/dashboards/DashboardBuilder";
import { HubPage } from "@/components/hub";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Dashboards - AI Web Feeds",
  description:
    "Create and manage custom analytics dashboards with drag-and-drop widget layout.",
  path: "/analytics/dashboards",
});

export default function DashboardsPage() {
  return (
    <div className="page-wrap page-stack">
      <HubPage
        eyebrow="Analytics"
        title="Dashboards"
        description="Compose multi-widget dashboards. Drag, resize, and configure visualizations into a unified view."
      >
        <div className="h-[720px] border border-border rounded-2xl overflow-hidden bg-background">
          <Suspense
            fallback={
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Loading dashboard builder...
              </div>
            }
          >
            <DashboardBuilder editable />
          </Suspense>
        </div>
      </HubPage>
    </div>
  );
}
