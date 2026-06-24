"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { reconcilePending, type ConflictInfo } from "@/lib/offline/offline-sync";

export function ConflictResolutionPanel() {
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [applied, setApplied] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);

  const runReconcile = useCallback(async () => {
    setLoading(true);
    try {
      const result = await reconcilePending();
      setConflicts(result.conflicts);
      setApplied(result.applied);
      setRan(true);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <section className="mx-auto w-full max-w-2xl text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-(--ink)">Sync conflicts</h2>
          <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
            Local changes always win. Review divergences detected during offline reconciliation.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void runReconcile()}
          disabled={loading}
        >
          <RefreshCw className="size-4" aria-hidden />
          {loading ? "Reconciling…" : "Reconcile now"}
        </Button>
      </div>

      {ran ? (
        <p className="mt-4 text-sm text-[color:var(--ink-muted)]">
          Applied {applied} queued operation{applied === 1 ? "" : "s"}.
        </p>
      ) : null}

      {conflicts.length === 0 && ran ? (
        <p className="mt-4 rounded-lg border border-(--line) bg-(--surface) px-4 py-3 text-sm text-(--ink)">
          No conflicts detected. Your local state is consistent.
        </p>
      ) : null}

      {conflicts.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {conflicts.map((conflict) => (
            <li
              key={`${conflict.articleId}-${conflict.localChange.id}`}
              className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                <div>
                  <p className="font-medium text-(--ink)">Article {conflict.articleId}</p>
                  <p className="mt-1 text-sm text-[color:var(--ink-muted)]">{conflict.reason}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                    Local {conflict.localChange.type} intent kept
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-6 text-sm">
        <Link href="/offline" className="text-(--accent) underline-offset-4 hover:underline">
          Back to offline hub
        </Link>
      </p>
    </section>
  );
}
