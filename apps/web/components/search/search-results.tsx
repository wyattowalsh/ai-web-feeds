"use client";

import Link from "next/link";
import { CalendarDays, ExternalLink, RadioTower, Search as SearchIcon } from "lucide-react";
import { SearchArtworkSlot, SEARCH_ARTWORKS } from "@/components/search/search-artwork";
import { EmptyState } from "@/components/ui/empty-state";
import { ContentCardSkeleton } from "@/components/ui/content-card-skeleton";
import type { SearchResponseMeta, SearchResult, SearchScope } from "@/lib/search";

interface SearchResultsProps {
  results: SearchResult[];
  scope: SearchScope;
  meta?: SearchResponseMeta;
  loading: boolean;
  readerBasePath?: string;
  readerMode?: "reader" | null;
}

function buildReaderHref(
  feedId: string,
  readerBasePath: string,
  readerMode: "reader" | null,
): string {
  const params = new URLSearchParams();
  if (readerMode) {
    params.set("mode", readerMode);
  }
  params.set("feed", feedId);
  return `${readerBasePath}?${params.toString()}`;
}

export function SearchResults({
  results,
  scope,
  meta,
  loading,
  readerBasePath = "/reader",
  readerMode = null,
}: SearchResultsProps) {
  if (loading) {
    return <ContentCardSkeleton count={5} />;
  }

  if (results.length === 0) {
    return (
      <EmptyState
        icon={SearchIcon}
        title="No results found"
        description="Try adjusting your query or loosening the current filters."
        media={
          <SearchArtworkSlot
            {...SEARCH_ARTWORKS.noResults}
            className="mx-auto w-full max-w-md"
            sizes="(min-width: 768px) 28rem, 100vw"
          />
        }
        tips={[
          "Use fewer filters to broaden the local catalog search.",
          scope === "articles"
            ? "Remove one or more filters to widen the recent-post slice and surface more articles."
            : "Search for topics, source names, or provider names.",
        ]}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="surface-card flex items-center justify-between">
        <div>
          <p className="text-sm text-(--ink-muted)">
            Found <strong>{results.length}</strong> {scope === "articles" ? "article" : "source"}{" "}
            result
            {results.length !== 1 ? "s" : ""}
          </p>
          {scope === "articles" && meta?.bounded ? (
            <p className="small-note mt-1">
              Retrieval is bounded: {meta.scanned_sources} of {meta.candidate_sources} matching
              sources scanned
              {meta.truncated ? " before ranking article results." : "."}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 rounded-full bg-(--brand-soft) px-3 py-2 text-xs font-semibold text-(--brand-strong)">
          {scope === "articles" ? (
            <CalendarDays className="size-3.5" />
          ) : (
            <RadioTower className="size-3.5" />
          )}
          {scope === "articles" ? "Articles" : "Sources"}
        </div>
      </div>

      {results.map((result, index) => (
        <div
          key={result.id}
          className="surface-card transition duration-150 hover:-translate-y-0.5"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-(--ink-muted)">#{index + 1}</span>
                <h3 className="text-xl font-bold text-(--ink)">{result.title}</h3>
                {result.verified && (
                  <span className="rounded-full bg-(--brand-soft) px-2.5 py-1 text-xs font-semibold text-(--brand-strong)">
                    ✓ Verified
                  </span>
                )}
                {!result.is_active && (
                  <span className="rounded-full bg-(--surface-muted) px-2.5 py-1 text-xs font-semibold text-(--ink-muted)">
                    Inactive
                  </span>
                )}
              </div>

              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-(--brand-strong) hover:underline"
              >
                <ExternalLink className="size-4" />
                {result.kind === "article" ? "Open article" : "Open source"}
              </a>
            </div>

            {result.kind === "source" && (
              <Link
                href={buildReaderHref(result.id, readerBasePath, readerMode)}
                className="inline-flex items-center gap-2 text-sm font-medium text-(--brand-strong) hover:underline"
              >
                <RadioTower className="size-4" />
                Open in reader
              </Link>
            )}

            {result.kind === "article" && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-(--ink-muted)">
                <span className="rounded-full border border-(--line) bg-(--surface) px-2.5 py-1 font-semibold">
                  {result.feed_title}
                </span>
                {result.published_at && (
                  <span className="rounded-full border border-(--line) bg-(--surface) px-2.5 py-1">
                    {new Date(result.published_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}

            {result.description && (
              <p className="text-sm text-(--ink-muted)">{result.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-(--line) bg-(--surface) px-2.5 py-1 text-xs font-semibold text-(--ink-muted)">
                {result.source_type}
              </span>
              {result.topics.map((topic) => (
                <span
                  key={`${result.id}-${topic}`}
                  className="rounded-full bg-(--brand-soft) px-2.5 py-1 text-xs font-semibold text-(--brand-strong)"
                >
                  {topic.toUpperCase()}
                </span>
              ))}
            </div>

            <div className="small-note break-all">{result.url}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
