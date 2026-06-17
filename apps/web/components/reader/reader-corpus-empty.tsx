"use client";

import Link from "next/link";
import { Newspaper } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { CANONICAL_CATALOG_PATH } from "@/lib/reader-routes";
import { LIVE_REFRESH_SAMPLE_FEED_LIMIT } from "@/lib/reader";

export type ReaderCorpusEmptyProps = {
  refreshError: string | null;
  refreshing: boolean;
  candidateFeedCount: number;
  onLoadLiveSample: () => void;
  headingOverride?: string | null;
};

export function ReaderCorpusEmpty({
  refreshError,
  refreshing,
  candidateFeedCount,
  onLoadLiveSample,
  headingOverride,
}: ReaderCorpusEmptyProps) {
  const defaultHeading = refreshError ? "Live posts unavailable" : "No prepared article corpus";
  const heading = headingOverride ?? defaultHeading;
  return (
    <div className="reader-shell space-y-4">
      <div className="surface-card border-(--line) bg-(--surface)">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="metric-label">AI Web Feeds</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {heading}
            </h1>
            <p className="small-note max-w-3xl">
              {refreshError
                ? `${refreshError} You can browse sources or retry.`
                : `The generated article corpus is empty or missing. Load a bounded live sample from up to ${Math.min(
                    candidateFeedCount,
                    LIVE_REFRESH_SAMPLE_FEED_LIMIT,
                  )} matching sources, or browse the catalog while the corpus is regenerated.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={CANONICAL_CATALOG_PATH}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Browse sources
            </Link>
            <Button
              type="button"
              variant="secondary"
              onClick={onLoadLiveSample}
              disabled={refreshing}
            >
              {refreshError ? "Try again" : "Load live sample"}
            </Button>
          </div>
        </div>
      </div>

      <EmptyState
        icon={Newspaper}
        iconClassName="size-6"
        title={refreshError ? "Could not fetch live posts" : "Prepared posts are unavailable"}
        description={
          refreshError
            ? "The source catalog is still available while live fetching recovers."
            : "Live fetching is available as an explicit sample so the first page load does not crawl the full catalog."
        }
        className="text-left"
      />
    </div>
  );
}
