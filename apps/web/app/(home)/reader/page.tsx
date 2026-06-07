import type { Metadata } from "next";
import { headers } from "next/headers";
import { JsonLd } from "@/components/json-ld";
import { loadReaderRouteData, ReaderPageSearchParams } from "@/lib/reader-route";
import { createPageMetadata } from "@/lib/seo";
import { collectionPageJsonLd } from "@/lib/structured-data";
import { FeedsWorkspaceClient } from "../../feeds/feeds-workspace-client";

export const metadata: Metadata = createPageMetadata({
  title: "AI Reader - AI Web Feeds",
  description:
    "Read recent AI writing from blogs, labs, newsletters, organizations, and research sources in one focused stream.",
  path: "/reader",
});

type ReaderPageProps = {
  searchParams: Promise<ReaderPageSearchParams>;
};

export default async function ReaderPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const { mode, feeds, stats, initialState, initialBrowse } =
    await loadReaderRouteData(searchParams);

  return (
    <div className="page-wrap page-stack">
      <JsonLd
        nonce={nonce}
        data={collectionPageJsonLd({
          name: "AI Reader",
          description:
            "Read recent AI writing from blogs, labs, newsletters, organizations, and research sources in one focused stream.",
          url: "/reader",
          items: (initialBrowse?.items ?? []).slice(0, 20).map((article) => ({
            name: article.title,
            url: article.link,
            description: article.summary,
          })),
        })}
      />
      <section className="space-y-8">
        <FeedsWorkspaceClient
          mode={mode}
          feeds={feeds}
          stats={stats}
          initialState={initialState}
          initialBrowse={initialBrowse}
        />
      </section>
    </div>
  );
}
