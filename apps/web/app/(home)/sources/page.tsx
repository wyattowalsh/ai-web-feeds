import type { Metadata } from "next";
import { FeedCatalog } from "../../feeds/feed-catalog";
import { getSourceTypes, loadFeedCatalog } from "@/lib/feeds";
import { normalizeSearchQuery, parseVerifiedSearchFilter } from "@/lib/search";
import type { ReaderPageSearchParams } from "@/lib/reader-route";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://aiwebfeeds.vercel.app";

export const metadata: Metadata = {
  title: "Sources - AI Web Feeds",
  description:
    "Browse the AI Web Feeds source catalog across blogs, labs, newsletters, organizations, and research feeds.",
  alternates: {
    canonical: `${baseUrl}/sources`,
  },
};

type SourcesPageProps = {
  searchParams: Promise<ReaderPageSearchParams>;
};

export default async function SourcesPage({ searchParams }: SourcesPageProps) {
  const params = toURLSearchParams(await searchParams);
  const feedsData = loadFeedCatalog();

  return (
    <div className="page-wrap page-stack">
      <FeedCatalog
        feeds={feedsData.sources}
        sourceTypes={getSourceTypes(feedsData.sources)}
        initialQuery={normalizeSearchQuery(params.get("q")) ?? ""}
        initialSourceType={params.get("source_type")?.trim() || null}
        initialTopic={params.get("topics")?.split(",")[0]?.trim() || null}
        initialVerified={parseVerifiedSearchFilter(params.get("verified")) ?? null}
      />
    </div>
  );
}

function toURLSearchParams(searchParams: ReaderPageSearchParams): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry);
      }
    } else if (typeof value === "string") {
      params.set(key, value);
    }
  }

  return params;
}
