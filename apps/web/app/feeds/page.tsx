import type { Metadata } from "next";
import { loadFeeds, getSourceTypes, getFeedStats } from "@/lib/feeds";
import { FeedCatalog } from "./feed-catalog";

export const metadata: Metadata = {
  title: "Feed Catalog - AIWebFeeds",
  description:
    "Browse and download curated AI/ML feeds for your RSS reader. High-quality feeds from blogs, podcasts, newsletters, preprints, and more.",
  openGraph: {
    title: "Feed Catalog - AIWebFeeds",
    description: "Browse and download curated AI/ML feeds for your RSS reader.",
  },
};

export default async function FeedsPage() {
  const feedsData = await loadFeeds();
  const feeds = feedsData.sources;
  const types = getSourceTypes(feeds);
  const stats = getFeedStats(feeds);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Feed Catalog</h1>
        <p className="text-lg text-muted-foreground">
          Browse {stats.total} curated AI/ML feeds. Filter by source type, topic, or verification
          status.
        </p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Feeds</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Verified</div>
          <div className="text-2xl font-bold">
            {stats.verified}{" "}
            <span className="text-sm text-muted-foreground">
              ({Math.round((stats.verified / stats.total) * 100)}%)
            </span>
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Active</div>
          <div className="text-2xl font-bold">
            {stats.active}{" "}
            <span className="text-sm text-muted-foreground">
              ({Math.round((stats.active / stats.total) * 100)}%)
            </span>
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Topics</div>
          <div className="text-2xl font-bold">{stats.topicCount}</div>
        </div>
      </div>

      {/* Feed Catalog Component */}
      <FeedCatalog feeds={feeds} sourceTypes={types} />
    </div>
  );
}
