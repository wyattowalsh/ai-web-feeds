"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ReaderPillTone = "neutral" | "brand" | "success" | "warning" | "info";

export type ReaderPillProps = {
  children: ReactNode;
  tone?: ReaderPillTone;
  className?: string;
};

/**
 * ReaderPill
 *
 * Extracted badge/pill pattern used across the reader workspace.
 * Provides tone-aware styling for status and metadata indicators.
 *
 * Tones:
 * - neutral: outline-like, muted (default)
 * - brand: primary accent (e.g. "New", "Reader")
 * - success: positive/verified state
 * - warning: attention/pending state (e.g. "Unread", "Starred")
 * - info: secondary highlight (e.g. "Saved")
 */
export function ReaderPill({ children, tone = "neutral", className }: ReaderPillProps) {
  const variant = tone === "neutral" ? "outline" : tone === "brand" ? "default" : "secondary";

  return (
    <Badge
      variant={variant}
      className={cn(
        "min-h-6 px-2.5 text-[0.68rem] uppercase tracking-[0.08em]",
        tone === "brand" && "border-primary/20 bg-primary/10 text-(--brand-strong)",
        tone === "success" &&
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        tone === "warning" &&
          "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        tone === "info" && "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        tone === "neutral" && "border-border bg-muted text-muted-foreground",
        className,
      )}
    >
      {children}
    </Badge>
  );
}

export default ReaderPill;
