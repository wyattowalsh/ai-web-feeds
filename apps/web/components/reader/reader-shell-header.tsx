"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { RefreshCcw } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { AggregatorBadge } from "@/components/hub/aggregator-badge";
import { ReaderPill } from "@/components/reader/reader-pill";
import { ImportExportSheet } from "@/components/utility/import-export-sheet";
import { cn } from "@/lib/cn";
import { CANONICAL_CATALOG_PATH } from "@/lib/reader-routes";

export type ReaderShellStat = {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
};

export type ReaderShellHeaderProps = {
  corpusEmpty: boolean;
  overlayCount: number;
  refreshing: boolean;
  liveStatusText: string | null;
  readerStats: ReaderShellStat[];
  onRefreshLatest: () => void;
};

export function ReaderShellHeader({
  corpusEmpty,
  overlayCount,
  refreshing,
  liveStatusText,
  readerStats,
  onRefreshLatest,
}: ReaderShellHeaderProps) {
  return (
    <div className="surface-card overflow-hidden border-border bg-card p-0 shadow-sm">
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end sm:p-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <ReaderPill tone="brand">Reader</ReaderPill>
            <AggregatorBadge
              variant={overlayCount > 0 ? "mixed" : corpusEmpty ? "live" : "corpus"}
            />
            {corpusEmpty ? (
              <ReaderPill tone="info">Live</ReaderPill>
            ) : (
              <ReaderPill>Prepared posts</ReaderPill>
            )}
            {refreshing ? <ReaderPill tone="warning">Refreshing</ReaderPill> : null}
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
              Read AI writing across the open web
            </h1>
            <p className="small-note max-w-3xl">
              A clean reading desk for open AI writing, with local read, save, and focus state.
            </p>
            {liveStatusText ? <p className="small-note">{liveStatusText}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button type="button" variant="outline" onClick={onRefreshLatest} disabled={refreshing}>
            <RefreshCcw className={cn("size-4", refreshing && "animate-spin")} />
            {refreshing ? "Checking..." : "Refresh latest"}
          </Button>
          <Link
            href={CANONICAL_CATALOG_PATH}
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            Sources
          </Link>
          <ImportExportSheet />
        </div>
      </div>
      <div className="hidden border-t border-border bg-muted/55 md:grid md:grid-cols-4">
        {readerStats.map(({ label, value, note, icon: Icon }) => (
          <div
            key={label}
            className="flex min-h-24 items-center gap-3 border-b border-(--line) px-5 py-4 last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-(--line) bg-(--surface) text-(--brand-strong)">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="metric-label">{label}</p>
              <p className="truncate text-base font-semibold text-(--ink)">{value}</p>
              <p className="truncate text-xs text-(--ink-muted)">{note}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
