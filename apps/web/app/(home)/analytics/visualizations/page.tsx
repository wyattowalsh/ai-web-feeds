import type { Metadata } from "next";
import { HubPage } from "@/components/hub";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Visualizations - AI Web Feeds",
  description: "The custom chart builder is not enabled. Real catalog rows only; demo is false.",
  path: "/analytics/visualizations",
});

export default function VisualizationsPage() {
  return (
    <div className="page-wrap page-stack">
      <HubPage
        eyebrow="Analytics"
        title="Visualizations"
        description="Custom charts stay off. Real catalog rows only."
      >
        <p className="text-sm text-muted-foreground">the custom chart builder is not enabled</p>
      </HubPage>
    </div>
  );
}
