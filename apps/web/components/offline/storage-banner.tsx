"use client";

import * as React from "react";
import { AlertTriangle, HardDrive, X } from "lucide-react";

import { getStorageQuota, type StorageQuota } from "@/lib/db/schema";
import { cn } from "@/lib/cn";

export type StorageBannerThreshold = 70 | 80 | 90;

export interface StorageBannerProps {
  /** Polling interval in ms (0 disables). Default 60s. */
  pollIntervalMs?: number;
  /** Additional class names */
  className?: string;
  /** Called when user requests cleanup action (e.g., open storage settings) */
  onRequestCleanup?: () => void;
  /** Test seam: inject a custom quota fetcher */
  quotaFetcher?: () => Promise<StorageQuota>;
}

const THRESHOLDS: StorageBannerThreshold[] = [70, 80, 90];

function getActiveThreshold(pct: number): StorageBannerThreshold | null {
  // Highest threshold crossed wins (90 > 80 > 70)
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
    const t = THRESHOLDS[i];
    if (pct >= t) return t;
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[u]}`;
}

export function StorageBanner({
  pollIntervalMs = 60_000,
  className,
  onRequestCleanup,
  quotaFetcher,
}: StorageBannerProps) {
  const [quota, setQuota] = React.useState<StorageQuota | null>(null);
  const [dismissed, setDismissed] = React.useState<StorageBannerThreshold | null>(null);
  const [loading, setLoading] = React.useState(false);

  const fetchQuota = React.useCallback(async () => {
    try {
      setLoading(true);
      const q = quotaFetcher ? await quotaFetcher() : await getStorageQuota();
      setQuota(q);
    } catch {
      // Non-fatal; keep previous state
    } finally {
      setLoading(false);
    }
  }, [quotaFetcher]);

  React.useEffect(() => {
    void fetchQuota();
  }, [fetchQuota]);

  React.useEffect(() => {
    if (!pollIntervalMs || pollIntervalMs <= 0) return;
    const id = window.setInterval(() => {
      void fetchQuota();
    }, pollIntervalMs);
    return () => window.clearInterval(id);
  }, [pollIntervalMs, fetchQuota]);

  if (!quota || quota.quota <= 0) {
    return null;
  }

  const pct = Math.max(0, Math.min(100, Math.round(quota.percentage)));
  const threshold = getActiveThreshold(pct);

  if (!threshold) return null;

  // If user dismissed this threshold or higher, hide until a higher threshold is hit
  if (dismissed && threshold <= dismissed) {
    return null;
  }

  const variant = threshold >= 90 ? "critical" : threshold >= 80 ? "warning" : ("info" as const);

  const messages: Record<StorageBannerThreshold, string> = {
    70: "Storage usage is above 70%. Consider cleaning up old articles to keep offline reading reliable.",
    80: "Storage is at 80%. Offline caching may be limited soon. Free space by removing read or older articles.",
    90: "Storage is nearly full (90%+). New offline saves are at risk. Clean up now to avoid data loss.",
  };

  const handleDismiss = () => setDismissed(threshold);

  const handleCleanup = () => {
    onRequestCleanup?.();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex w-full items-start gap-3 border px-3 py-2 text-sm",
        "border-(--line) bg-(--surface)",
        variant === "critical" &&
          "border-destructive/40 bg-destructive/5 text-destructive dark:border-destructive/50",
        variant === "warning" &&
          "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
        variant === "info" && "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300",
        className,
      )}
    >
      <div className="mt-0.5 shrink-0">
        {variant === "critical" ? (
          <AlertTriangle className="size-4" aria-hidden />
        ) : (
          <HardDrive className="size-4" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">
            {variant === "critical" ? "Storage critical" : "Storage notice"}
          </span>
          <span className="rounded border border-current/20 px-1.5 py-0.5 text-[10px] tracking-[0.04em] uppercase">
            {pct}% used
          </span>
          <span className="text-[10px] text-(--ink-muted)">
            {formatBytes(quota.usage)} / {formatBytes(quota.quota)}
          </span>
        </div>
        <p className="mt-0.5 text-(--ink)">{messages[threshold]}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCleanup}
            className="inline-flex items-center rounded-md border border-current/30 px-2 py-0.5 text-xs hover:bg-current/5"
          >
            Manage storage
          </button>
          <button
            type="button"
            onClick={() => void fetchQuota()}
            className="inline-flex items-center rounded-md px-2 py-0.5 text-xs opacity-70 hover:opacity-100"
            disabled={loading}
          >
            {loading ? "Checking…" : "Recheck"}
          </button>
        </div>
      </div>

      <button
        type="button"
        aria-label="Dismiss storage notice"
        onClick={handleDismiss}
        className="ml-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md opacity-60 transition hover:bg-foreground/10 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

export default StorageBanner;
