import { Suspense } from "react";
import { RecommendationsPageClient } from "@/components/recommendations/recommendations-page-client";

export default function RecommendationsPage() {
  return (
    <Suspense fallback={<div className="page-wrap py-16" />}>
      <RecommendationsPageClient />
    </Suspense>
  );
}
