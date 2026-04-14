import { Suspense } from "react";
import { RecommendationsPageClient } from "@/components/recommendations/recommendations-page-client";

export default function RecommendationsPage() {
  const backendConfigured = Boolean(process.env.BACKEND_URL?.trim());

  return (
    <Suspense fallback={<div className="page-wrap py-16" />}>
      <RecommendationsPageClient backendConfigured={backendConfigured} />
    </Suspense>
  );
}
