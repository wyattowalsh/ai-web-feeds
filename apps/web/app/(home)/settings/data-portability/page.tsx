"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  downloadText,
  exportArticlesCsv,
  exportHtml,
  exportJson,
  exportOpml,
} from "@/lib/exports/export-service";
import { recordPerfMetric } from "@/lib/diagnostics/perf-metrics";
import { importBundle, parseImportJson } from "@/lib/exports/import-service";

export default function DataPortabilityPage() {
  const [status, setStatus] = useState<string | null>(null);

  const runExport = async (kind: "json" | "csv" | "opml" | "html") => {
    const started = performance.now();
    if (kind === "json") downloadText("ai-web-feeds.json", await exportJson(), "application/json");
    if (kind === "csv") downloadText("articles.csv", await exportArticlesCsv(), "text/csv");
    if (kind === "opml") downloadText("feeds.opml", await exportOpml(), "application/xml");
    if (kind === "html") downloadText("articles.html", await exportHtml(), "text/html");
    const elapsed = performance.now() - started;
    recordPerfMetric({ lastExportMs: elapsed });
    setStatus(`Exported ${kind} in ${elapsed.toFixed(1)} ms`);
  };

  const onImport = async (file: File) => {
    const raw = await file.text();
    const bundle = parseImportJson(raw);
    const result = await importBundle(bundle);
    setStatus(
      `Imported ${result.articles} articles, ${result.feeds} feeds, ${result.folders} folders` +
        (result.errors.length ? ` · ${result.errors.length} warnings` : ""),
    );
  };

  return (
    <div className="page-wrap page-stack py-8">
      <h1 className="text-3xl font-semibold text-(--ink)">Data portability</h1>
      <p className="mt-2 max-w-2xl text-sm text-(--ink-muted)">
        Export or import your local reader data. All processing happens in the browser.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button type="button" onClick={() => void runExport("json")}>
          Export JSON
        </Button>
        <Button type="button" variant="secondary" onClick={() => void runExport("csv")}>
          Export CSV
        </Button>
        <Button type="button" variant="secondary" onClick={() => void runExport("opml")}>
          Export OPML
        </Button>
        <Button type="button" variant="secondary" onClick={() => void runExport("html")}>
          Export HTML
        </Button>
        <label className="inline-flex cursor-pointer items-center rounded-xl border border-(--line) px-4 py-2 text-sm">
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onImport(file);
            }}
          />
        </label>
      </div>

      {status ? <p className="mt-4 text-sm text-(--ink-muted)">{status}</p> : null}
    </div>
  );
}
