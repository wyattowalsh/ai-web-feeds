"use client";

import { useEffect, useState } from "react";

import { loadPerfMetrics, type PerfMetrics } from "@/lib/diagnostics/perf-metrics";

function statusFor(value: number | null, budget: number): "pass" | "warn" | "unknown" {
  if (value == null) return "unknown";
  return value <= budget ? "pass" : "warn";
}

export default function PerformanceDashboardPage() {
  const [metrics, setMetrics] = useState<PerfMetrics>(() => loadPerfMetrics());

  useEffect(() => {
    const id = window.setInterval(() => setMetrics(loadPerfMetrics()), 2000);
    return () => window.clearInterval(id);
  }, []);

  const rows = [
    {
      label: "Cached search",
      value: metrics.lastSearchMs,
      budget: 50,
      unit: "ms",
      target: "< 50 ms",
    },
    {
      label: "Client export",
      value: metrics.lastExportMs,
      budget: 5000,
      unit: "ms",
      target: "< 5 s",
    },
    {
      label: "UI frame budget",
      value: metrics.uiFrameBudgetMs,
      budget: 16,
      unit: "ms",
      target: "< 16 ms",
    },
  ];

  return (
    <div className="page-wrap page-stack py-8">
      <h1 className="text-3xl font-semibold text-(--ink)">Performance dashboard</h1>
      <p className="mt-2 max-w-2xl text-sm text-(--ink-muted)">
        Tracks client-side budgets from search, export, and UI interactions. Updated{" "}
        {new Date(metrics.updatedAt).toLocaleString()}.
      </p>

      <ul className="mt-6 divide-y divide-(--line) rounded-lg border border-(--line) bg-(--surface)">
        {rows.map((row) => {
          const status = statusFor(row.value, row.budget);
          return (
            <li
              key={row.label}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div>
                <div className="font-medium text-(--ink)">{row.label}</div>
                <div className="text-xs text-(--ink-muted)">Target {row.target}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-(--ink)">
                  {row.value == null ? "—" : `${row.value.toFixed(1)} ${row.unit}`}
                </span>
                <span
                  className={
                    status === "pass"
                      ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300"
                      : status === "warn"
                        ? "rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300"
                        : "rounded-full bg-(--surface-muted) px-2 py-0.5 text-xs text-(--ink-muted)"
                  }
                >
                  {status === "pass"
                    ? "Within budget"
                    : status === "warn"
                      ? "Over budget"
                      : "No sample"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-sm text-(--ink-muted)">
        Run a cached search on <a href="/search">/search</a> or export from{" "}
        <a href="/settings/data-portability">Data portability</a> to populate samples.
      </p>
    </div>
  );
}
