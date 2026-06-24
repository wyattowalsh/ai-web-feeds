const METRICS_KEY = "aiwebfeeds.perfMetrics";

export type PerfMetrics = {
  lastSearchMs: number | null;
  lastExportMs: number | null;
  uiFrameBudgetMs: number;
  updatedAt: number;
};

const DEFAULT_METRICS: PerfMetrics = {
  lastSearchMs: null,
  lastExportMs: null,
  uiFrameBudgetMs: 16,
  updatedAt: Date.now(),
};

export function loadPerfMetrics(): PerfMetrics {
  if (typeof window === "undefined") return { ...DEFAULT_METRICS };
  try {
    const raw = localStorage.getItem(METRICS_KEY);
    if (!raw) return { ...DEFAULT_METRICS };
    return { ...DEFAULT_METRICS, ...(JSON.parse(raw) as Partial<PerfMetrics>) };
  } catch {
    return { ...DEFAULT_METRICS };
  }
}

export function recordPerfMetric(patch: Partial<PerfMetrics>): void {
  if (typeof window === "undefined") return;
  const next = { ...loadPerfMetrics(), ...patch, updatedAt: Date.now() };
  localStorage.setItem(METRICS_KEY, JSON.stringify(next));
}
