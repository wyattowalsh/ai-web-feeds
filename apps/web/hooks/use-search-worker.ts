"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { recordPerfMetric } from "@/lib/diagnostics/perf-metrics";
import { articles } from "@/lib/db";
import { getSearchIndexManager, type SearchWorkerResult } from "@/lib/search/index-manager";

export function useSearchWorker() {
  const managerRef = useRef(getSearchIndexManager());
  const [ready, setReady] = useState(false);
  const [building, setBuilding] = useState(false);
  const [lastElapsedMs, setLastElapsedMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBuilding(true);

    void (async () => {
      try {
        const cached = await articles.getAll();
        await managerRef.current.start(cached);
        if (!cancelled) setReady(true);
      } finally {
        if (!cancelled) setBuilding(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const query = useCallback(async (q: string, limit = 30): Promise<SearchWorkerResult> => {
    const result = await managerRef.current.query(q, limit);
    setLastElapsedMs(result.elapsedMs);
    recordPerfMetric({ lastSearchMs: result.elapsedMs });
    return result;
  }, []);

  return { ready, building, query, lastElapsedMs };
}
