"use client";

import { SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  ReaderFiltersForm,
  type ReaderFiltersFormProps,
} from "@/components/reader/reader-filters-form";

export type ReaderFilterRailProps = {
  variant: "desktop" | "mobile";
  filters: Omit<ReaderFiltersFormProps, "variant">;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  activeFilterCount?: number;
  filterSummary?: string;
  visibleArticleCountLabel?: string;
  visibleCount?: number;
  corpusArticleCount?: number;
  corpusFeedCount?: number;
  catalogTotal?: number;
  catalogTopicCount?: number;
  /** When true, disables all filter inputs and actions (e.g., empty corpus, no live overlay) */
  filtersDisabled?: boolean;
};

export function ReaderFilterRail({
  variant,
  filters,
  mobileOpen = false,
  onMobileOpenChange,
  activeFilterCount = 0,
  filterSummary = "",
  visibleArticleCountLabel = "",
  visibleCount = 0,
  corpusArticleCount = 0,
  corpusFeedCount = 0,
  catalogTotal = 0,
  catalogTopicCount = 0,
  filtersDisabled,
}: ReaderFilterRailProps) {
  if (variant === "desktop") {
    return (
      <div className="hidden xl:block xl:sticky xl:top-24 xl:self-start">
        <div className="surface-card border-(--line) bg-(--surface) p-4">
          <div className="space-y-2">
            <p className="metric-label">Focus</p>
            <p className="small-note">Narrow the stream without leaving the reader.</p>
          </div>
          <ReaderFiltersForm variant="desktop" filtersDisabled={filtersDisabled} {...filters} />

          <div className="surface-card-soft mt-5 border-(--line) p-4">
            <p className="metric-label">Current view</p>
            <div className="mt-3 space-y-2 text-sm text-(--ink-muted)">
              <p>{filterSummary}</p>
              <p>
                {visibleArticleCountLabel} · {visibleCount} visible on this page
              </p>
              <p>
                Prepared: {corpusArticleCount} articles from {corpusFeedCount} sources
              </p>
              <p>
                Catalog: {catalogTotal} tracked sources · {catalogTopicCount} topics
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <details
      className={cn(
        "surface-card relative isolate z-20 border-(--line) bg-(--surface) p-4 xl:hidden",
        filtersDisabled && "pointer-events-none opacity-60",
      )}
      open={filtersDisabled ? false : mobileOpen}
      onToggle={(event) => {
        if (filtersDisabled) {
          event.preventDefault();
          return;
        }
        onMobileOpenChange?.((event.currentTarget as HTMLDetailsElement).open);
      }}
    >
      <summary
        className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 py-3"
        aria-disabled={filtersDisabled || undefined}
        tabIndex={filtersDisabled ? -1 : undefined}
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-(--ink-muted)" />
          <span className="text-sm font-semibold text-(--ink)">Filters and view</span>
        </div>
        <span className="small-note">
          {activeFilterCount > 0 ? `${activeFilterCount} active` : "All posts"}
        </span>
      </summary>
      <ReaderFiltersForm variant="mobile" filtersDisabled={filtersDisabled} {...filters} />
    </details>
  );
}
