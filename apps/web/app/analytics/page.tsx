import { AnalyticsPageClient } from "@/components/analytics/analytics-page-client";

export default function AnalyticsPage() {
  return <AnalyticsPageClient backendConfigured={Boolean(process.env.BACKEND_URL?.trim())} />;
}
