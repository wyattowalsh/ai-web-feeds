import { Suspense } from "react";
import type { Metadata } from "next";
import { ReaderPageClient } from "@/components/reader/reader-page-client";
import { loadFeedCatalog } from "@/lib/feeds";

export const metadata: Metadata = {
  title: "Reader - AI Web Feeds",
  description:
    "Read the latest posts from the AI Web Feeds catalog. Filter by feed or topic and keep local reading state in the browser.",
  openGraph: {
    title: "Reader - AI Web Feeds",
    description: "Read the latest posts from the AI Web Feeds catalog with a local-first reader.",
  },
};

export default function ReaderPage() {
  const feeds = loadFeedCatalog().sources.map((feed) => ({
    id: feed.id || feed.url,
    title: feed.title,
    sourceType: feed.source_type || "feed",
    topics: feed.topics ?? [],
    verified: feed.verified === true,
    isActive: feed.is_active !== false,
    url: feed.url,
  }));

  return (
    <Suspense fallback={<div className="page-wrap py-16" />}>
      <ReaderPageClient feeds={feeds} />
    </Suspense>
  );
}
