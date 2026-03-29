"use client";

import { ExternalLink, Search as SearchIcon, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ContentCardSkeleton } from "@/components/ui/content-card-skeleton";

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  url: string;
  topics: string[];
  source_type: string;
  verified: boolean;
  is_active: boolean;
  similarity?: number;
}

export function SearchResults({
  results,
  searchType,
  loading,
  onResultClick,
}: {
  results: SearchResult[];
  searchType: "full_text" | "semantic";
  loading: boolean;
  onResultClick?: (feedId: string) => void;
}) {
  if (loading) {
    return <ContentCardSkeleton count={5} />;
  }

  if (results.length === 0) {
    return (
      <EmptyState
        icon={SearchIcon}
        title="No results found"
        description="Try adjusting your search query or loosening the current filters."
        tips={[
          "Use fewer filters or switch between full-text and semantic modes.",
          "Lower the semantic threshold if similarity matching is too narrow.",
        ]}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="surface-card flex items-center justify-between">
        <p className="text-sm text-(--ink-muted)">
          Found <strong>{results.length}</strong> result{results.length !== 1 ? "s" : ""}
          {searchType === "semantic" && " (sorted by similarity)"}
        </p>
        <div className="flex items-center gap-2 rounded-full bg-(--brand-soft) px-3 py-2 text-xs font-semibold text-(--brand-strong)">
          <Sparkles className="size-3.5" />
          {searchType === "semantic" ? "Semantic" : "Full-text"}
        </div>
      </div>

      {results.map((result, idx) => (
        <div
          key={result.id}
          className="surface-card transition duration-150 hover:-translate-y-0.5"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-(--ink-muted)">#{idx + 1}</span>
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
                {searchType === "semantic" && result.similarity !== undefined && (
                  <span className="rounded-full border border-(--line) bg-(--surface) px-2.5 py-1 text-xs font-mono text-(--ink)">
                    {(result.similarity * 100).toFixed(1)}%
                  </span>
                )}
              </div>

              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onResultClick?.(result.id)}
                className="inline-flex items-center gap-2 text-sm font-medium text-(--brand-strong) hover:underline"
              >
                <ExternalLink className="size-4" />
                Open source
              </a>
            </div>

            {result.description && (
              <p className="text-sm text-(--ink-muted)">{result.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-(--line) bg-(--surface) px-2.5 py-1 text-xs font-semibold text-(--ink-muted)">
                {result.source_type}
              </span>
              {result.topics.map((topic) => (
                <span
                  key={topic}
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
