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
import { CANONICAL_READER_PATH } from "@/lib/reader-routes";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { buildImmersiveReaderHref } from "@/lib/reader/reader-href";

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
    readerHref: buildImmersiveReaderHref({
      id: article.id,
      title: article.title,
      link: article.link,
    }),
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
        actions={null}
      >
        <form
          method="get"
          className="surface-card flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
          aria-label="Search the corpus"
        >
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--ink-muted)" />
            <input
              type="text"
              name="q"
              defaultValue={query ?? ""}
              placeholder="Search title, summary, feed, or topic"
              className="w-full rounded-xl border border-(--line) bg-(--surface) py-2 pl-10 pr-3 text-sm placeholder:text-(--ink-muted) focus:outline-none focus:ring-2 focus:ring-(--brand)"
              aria-label="Search query"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl border border-(--line) bg-(--surface) px-4 py-2 text-sm font-medium text-(--ink) hover:bg-(--surface-muted)"
          >
            Search
          </button>
        </form>

        {query ? (
          <div className="surface-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-(--ink-muted)">
              Showing results for <span className="font-semibold text-(--ink)">{query}</span>
            </p>
            <Link
              href={`${CANONICAL_READER_PATH}?q=${encodeURIComponent(query)}`}
              className={cn(buttonVariants({ variant: "default" }))}
            >
              Continue in reader
            </Link>
          </div>
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
          <section aria-labelledby="search-results-heading" className="space-y-4">
            <h2 id="search-results-heading" className="sr-only">
              Search results
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {teasers.map((article) => (
                <ArticleTeaser key={article.id} article={article} readerHref={article.readerHref} />
              ))}
            </div>
          </section>
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
