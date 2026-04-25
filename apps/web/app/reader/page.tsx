import { Suspense } from "react";
import type { Metadata } from "next";
import { ReaderPageClient } from "@/components/reader/reader-page-client";
import { loadFeedCatalog } from "@/lib/feeds";

export const metadata: Metadata = {
  title: "Reader",
  description:
    "Browse recent posts from the AI source registry, filter by topic or feed, and manage local reading state in the built-in reader.",
};

export default function ReaderPage() {
  const catalog = loadFeedCatalog().sources;
  const feeds = catalog
    .map((feed) => ({
      id: feed.id || feed.title || feed.url,
      title: feed.title || feed.url,
      sourceType: feed.source_type || "feed",
      topics: Array.isArray(feed.topics) ? feed.topics : [],
      verified: feed.verified === true,
      isActive: feed.is_active !== false,
      url: feed.site || feed.website_url || feed.url,
    }))
    .sort((left, right) => {
      if (left.verified !== right.verified) {
        return left.verified ? -1 : 1;
      }

      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }

      return left.title.localeCompare(right.title);
    });

  return (
    <Suspense fallback={<div className="page-wrap py-16" />}>
      <ReaderPageClient feeds={feeds} />
    </Suspense>
  );
}
