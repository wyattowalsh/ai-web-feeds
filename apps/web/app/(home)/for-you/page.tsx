import type { Metadata } from "next";
import { HubPage } from "@/components/hub";
import { RecommendationsPageClient } from "@/components/recommendations/recommendations-page-client";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "For You - AI Web Feeds",
  description:
    "Personalized recommendations and digests when the optional backend recommender is enabled.",
  path: "/for-you",
});

export default function ForYouPage() {
  return (
    <div className="page-wrap page-stack">
      <HubPage
        eyebrow="Personalization"
        title="For You"
        description="Recommendations and topic-steered discovery powered by the optional ai-web-feeds backend. The core reader and catalog remain fully functional without it."
      >
        <RecommendationsPageClient backendConfigured />
      </HubPage>
    </div>
  );
}
