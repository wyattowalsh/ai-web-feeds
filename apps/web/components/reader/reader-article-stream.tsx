"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCheck, Eye, Newspaper } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceAvatar } from "@/components/source-avatar";
import { ReaderFilterChipBar } from "@/components/reader/reader-filter-chip-bar";
import { ReaderPreviewPane } from "@/components/reader/reader-preview-pane";
import { ReaderPill } from "@/components/reader/reader-pill";
import { cn } from "@/lib/cn";
import type { FeedSource } from "@/lib/feeds-filters";
import {
  DEFAULT_ARTICLE_STATE,
  formatArticleDate,
  getArticleTopics,
  type FilterChip,
  type ReaderArticleState,
  type WorkspaceArticle,
} from "@/lib/reader";

export type ReaderArticleStreamProps = {
  query: string;
  filterSummary: string;
  refreshError: string | null;
  error: string | null;
  activeFilterChips: FilterChip[];
  loading: boolean;
  refreshing: boolean;
  visibleArticles: WorkspaceArticle[];
  articleStateMap: Record<string, ReaderArticleState>;
  selectedArticleId: string | null;
  feedLookup: Map<string, FeedSource>;
  layout: "cards" | "list" | "compact";
  showSummaries: boolean;
  browseCursor: number;
  browseLimit: number;
  browseNextCursor: number | null;
  canClearArticleFilters: boolean;
  canResetWorkspace: boolean;
  clearArticleFiltersHref: string;
  resetWorkspaceHref: string;
  catalogRecoveryHref: string;
  onSelectArticle: (articleId: string) => void;
  onUpdateState: (articleId: string, partial: Partial<ReaderArticleState>) => void;
  onClosePreview: () => void;
  onFilterChip: (overrides: Record<string, string | string[] | null | undefined>) => void;
  onResetDrafts: () => void;
  onPaginate: (cursor: string | null) => void;
  corpusEmptyPanel?: ReactNode;
};

export function ReaderArticleStream({
  query,
  filterSummary,
  refreshError,
  error,
  activeFilterChips,
  loading,
  refreshing,
  visibleArticles,
  articleStateMap,
  selectedArticleId,
  feedLookup,
  layout,
  showSummaries,
  browseCursor,
  browseLimit,
  browseNextCursor,
  canClearArticleFilters,
  canResetWorkspace,
  clearArticleFiltersHref,
  resetWorkspaceHref,
  catalogRecoveryHref,
  onSelectArticle,
  onUpdateState,
  onClosePreview,
  onFilterChip,
  onResetDrafts,
  onPaginate,
  corpusEmptyPanel,
}: ReaderArticleStreamProps) {
  const showLoading = loading || (refreshing && visibleArticles.length === 0);

  return (
    <section
      id="article-list"
      className="surface-card relative z-0 border-(--line) bg-(--surface) p-0"
    >
      <div className="space-y-4 border-b border-(--line) p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="metric-label">Stream</p>
            <h2 className="text-xl font-semibold tracking-tight text-(--ink) sm:text-2xl">
              {query ? `Results for “${query}”` : "Latest posts"}
            </h2>
            <p className="small-note">
              {filterSummary}. Refresh latest keeps your current reading state.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {refreshError ? <p className="text-sm text-amber-700">{refreshError}</p> : null}
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          </div>
        </div>

        <ReaderFilterChipBar
          chips={activeFilterChips}
          onFilterChip={onFilterChip}
          onResetDrafts={onResetDrafts}
        />
      </div>

      {showLoading ? (
        <div className="grid gap-3 p-5">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={`loading-${index}`} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="size-9 rounded-lg" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-5 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : visibleArticles.length === 0 && corpusEmptyPanel ? (
        <div className="p-5">{corpusEmptyPanel}</div>
      ) : visibleArticles.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="No posts match these filters"
          description="Clear filters, reset the page, or browse sources instead."
        >
          <div className="flex flex-wrap justify-center gap-3">
            {canClearArticleFilters ? (
              <Link
                href={clearArticleFiltersHref}
                className={cn(buttonVariants({ variant: "default" }))}
              >
                Clear article filters
              </Link>
            ) : null}
            {canResetWorkspace ? (
              <Link
                href={resetWorkspaceHref}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Reset all filters
              </Link>
            ) : null}
            <Link
              href={catalogRecoveryHref}
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              Browse sources
            </Link>
          </div>
        </EmptyState>
      ) : (
        <div className="divide-y divide-(--line)">
          {visibleArticles.map((article) => {
            const state = articleStateMap[article.id] ?? DEFAULT_ARTICLE_STATE;
            const isSelected = article.id === selectedArticleId;
            const articleTopics = getArticleTopics(article);

            return (
              <article
                key={article.id}
                className={cn(
                  "group w-full p-5 text-left transition duration-150",
                  isSelected
                    ? "bg-(--brand-soft)"
                    : "bg-(--surface) hover:bg-[color-mix(in_oklab,var(--brand-soft)_45%,var(--surface))]",
                  (layout === "list" || layout === "compact") && "py-4",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectArticle(article.id)}
                  className="w-full text-left"
                  aria-pressed={isSelected}
                >
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(9rem,12rem)]">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <SourceAvatar
                          source={
                            feedLookup.get(article.feed_id) ?? {
                              title: article.feed_title,
                              url: article.source_url ?? article.link,
                            }
                          }
                          className="size-8"
                        />
                        <span className="truncate text-sm font-semibold text-(--ink-muted)">
                          {article.feed_title}
                        </span>
                        {article.freshness === "live" ? (
                          <ReaderPill tone="brand">New</ReaderPill>
                        ) : null}
                        {article.freshness === "cached" ? (
                          <ReaderPill tone="info">Cached</ReaderPill>
                        ) : null}
                        {state.read ? <ReaderPill tone="success">Read</ReaderPill> : null}
                        {state.bookmarked ? <ReaderPill tone="info">Saved</ReaderPill> : null}
                        {state.starred ? <ReaderPill tone="warning">Starred</ReaderPill> : null}
                      </div>
                      <h3 className="break-words text-lg font-semibold leading-snug text-(--ink) [overflow-wrap:anywhere] group-hover:text-(--brand-strong)">
                        {article.title}
                      </h3>
                      {showSummaries && article.summary ? (
                        <p className="small-note max-w-3xl">{article.summary}</p>
                      ) : null}
                    </div>

                    <div className="min-w-0 space-y-2 text-sm text-(--ink-muted) lg:text-right">
                      <div>{formatArticleDate(article.published_at)}</div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {state.archived ? <ReaderPill>Archived</ReaderPill> : null}
                        {article.author ? (
                          <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                            {article.author}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {articleTopics.slice(0, 4).map((topic) => (
                      <span
                        key={`${article.id}-${topic}`}
                        className="rounded-md border border-(--line) bg-(--surface-muted) px-2.5 py-1 text-xs font-semibold text-(--ink-muted)"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={isSelected ? "secondary" : "outline"}
                      onClick={() => onSelectArticle(article.id)}
                    >
                      <Eye className="size-4" />
                      {isSelected ? "Hide details" : "Preview"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={state.read ? "secondary" : "ghost"}
                      onClick={() => onUpdateState(article.id, { read: !state.read })}
                    >
                      <CheckCheck className="size-4" />
                      {state.read ? "Marked read" : "Mark read"}
                    </Button>
                  </div>
                </div>

                {isSelected ? (
                  <div className="mt-4 xl:hidden">
                    <ReaderPreviewPane
                      article={article}
                      source={feedLookup.get(article.feed_id)}
                      state={state}
                      variant="inline"
                      onClose={onClosePreview}
                      onToggleState={(partial) => onUpdateState(article.id, partial)}
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--line) p-5">
        <p className="small-note">
          Page offset {browseCursor} · showing up to {browseLimit} results per page
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={browseCursor === 0}
            onClick={() =>
              onPaginate(browseCursor > browseLimit ? String(browseCursor - browseLimit) : null)
            }
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={browseNextCursor === null}
            onClick={() => onPaginate(browseNextCursor === null ? null : String(browseNextCursor))}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
