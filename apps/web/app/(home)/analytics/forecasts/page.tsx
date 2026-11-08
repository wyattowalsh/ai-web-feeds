import type { Metadata } from "next";
import { HubPage } from "@/components/hub";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Forecasts - AI Web Feeds",
  description:
    "Time-series forecasts stay disabled. Real catalog rows only; forecast is not enabled.",
  path: "/analytics/forecasts",
});

export default function ForecastsPage() {
  return (
    <div className="page-wrap page-stack">
      <HubPage
        eyebrow="Analytics"
        title="Forecasts"
        description="Predictive topic trends stay off. Real catalog rows only."
      >
        <p className="text-sm text-muted-foreground">forecast is not enabled</p>
      </HubPage>
    </div>
  );
}
