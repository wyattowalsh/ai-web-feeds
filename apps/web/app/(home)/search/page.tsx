import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Search as SearchIcon } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { ArticleTeaser, HubPage } from "@/components/hub";
import { getRequestNonce } from "@/lib/nonce";
import { browseArticleCorpus } from "@/lib/article-corpus";
import { createPageMetadata } from "@/lib/seo";
import { collectionPageJsonLd } from "@/lib/structured-data";
import type { HubTeaserArticle } from "@/lib/hub/types";
import type { ReaderPageSearchParams } from "@/lib/reader-route";
import { normalizeSearchQuery } from "@/lib/search";
import { getArticlePath } from "@/lib/public-content";

export const metadata: Metadata = createPageMetadata({
  title: "Search - AI Web Feeds",
  description:
    "Search the article corpus for recent AI writing. Results are served from the local reader index.",
  path: "/search",
});

type SearchPageProps = {
  searchParams: Promise<ReaderPageSearchParams>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const nonce = await getRequestNonce();
  const params = await searchParams;
  const query = normalizeSearchQuery(
    typeof params.q === "string" ? params.q : Array.isArray(params.q) ? params.q[0] : undefined,
  );

  const browse = await browseArticleCorpus({
    q: query ?? undefined,
    limit: 30,
  }).catch(() => null);

  const items = browse?.items ?? [];
  const teasers: HubTeaserArticle[] = items.map((article) => ({
    id: article.id,
    title: article.title,
    href: getArticlePath(article),
    summary: article.summary,
    sourceName: article.feed_title,
    publishedAt: article.published_at,
    topics: article.topics,
  }));

  return (
    <div className="page-wrap page-stack">
      <JsonLd
        nonce={nonce}
        data={collectionPageJsonLd({
          name: "Search - AI Web Feeds",
          description: "Search the tracked AI article corpus.",
          url: "/search",
          items: teasers.slice(0, 12).map((t) => ({
            name: t.title,
            url: t.href,
            description: t.summary ?? undefined,
          })),
        })}
      />
      <HubPage
        eyebrow={
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-(--ink-muted)">
            <Compass className="size-4" /> Search
          </span>
        }
        title="Search the corpus"
        description="Query recent articles pulled into the local corpus. Matches use title, summary, feed, and topic signals."
        actions={
          !query ? (
            <span className="inline-flex items-center gap-2 rounded-md border border-(--line) bg-(--surface) px-3 py-1 text-xs font-medium text-(--ink-muted)">
              <SearchIcon className="size-3.5" /> Use ?q=... or global search
            </span>
          ) : undefined
        }
      >
        {query ? (
          <p className="text-sm text-(--ink-muted) -mt-4">
            Showing results for <span className="font-semibold text-(--ink)">{query}</span>
          </p>
        ) : null}

        {teasers.length === 0 ? (
          <div className="surface-card space-y-3 py-10 text-center">
            <p className="text-lg font-semibold text-(--ink)">No matching articles found.</p>
            <p className="text-sm text-(--ink-muted)">
              Try a broader term like llm, agents, or evaluation. The corpus is updated periodically
              from tracked sources.
            </p>
            <Link
              href="/reader"
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Open the full reader
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {teasers.map((article) => (
              <ArticleTeaser key={article.id} article={article} />
            ))}
          </div>
        )}

        {browse && (
          <p className="small-note text-center pt-2">
            {browse.total_matched} matched · corpus snapshot{" "}
            {browse.corpus.latest_published_at ?? "n/a"}
          </p>
        )}
      </HubPage>
    </div>
  );
}
