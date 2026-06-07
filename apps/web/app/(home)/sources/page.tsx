import type { Metadata } from "next";
import { headers } from "next/headers";
import { JsonLd } from "@/components/json-ld";
import { FeedCatalog } from "../../feeds/feed-catalog";
import { getSourceTypes, loadFeedCatalog } from "@/lib/feeds";
import { getSourcePath, getSourceTitle } from "@/lib/public-content";
import { normalizeSearchQuery, parseVerifiedSearchFilter } from "@/lib/search";
import { createPageMetadata } from "@/lib/seo";
import { collectionPageJsonLd } from "@/lib/structured-data";
import type { ReaderPageSearchParams } from "@/lib/reader-route";

export const metadata: Metadata = createPageMetadata({
  title: "Sources - AI Web Feeds",
  description:
    "Browse the AI Web Feeds source catalog across blogs, labs, newsletters, organizations, and research feeds.",
  path: "/sources",
});

type SourcesPageProps = {
  searchParams: Promise<ReaderPageSearchParams>;
};

export default async function SourcesPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const params = toURLSearchParams(await searchParams);
  const feedsData = loadFeedCatalog();

  return (
    <div className="page-wrap page-stack">
      <JsonLd
        nonce={nonce}
        data={collectionPageJsonLd({
          name: "AI Web Feeds Sources",
          description:
            "Browse AI writing sources across blogs, labs, newsletters, organizations, and research feeds.",
          url: "/sources",
          items: feedsData.sources.slice(0, 50).map((source) => ({
            name: getSourceTitle(source),
            url: getSourcePath(source),
            description: source.description,
          })),
        })}
      />
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
