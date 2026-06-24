"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  clearDiagnostics,
  diagnosticLog,
  exportDiagnosticsJson,
} from "@/lib/diagnostics/log-buffer";

export default function DiagnosticsPage() {
  const [json, setJson] = useState(() => exportDiagnosticsJson());

  const refresh = () => setJson(exportDiagnosticsJson());

  return (
    <div className="page-wrap page-stack py-8">
      <h1 className="text-3xl font-semibold text-(--ink)">Diagnostics</h1>
      <p className="mt-2 text-sm text-(--ink-muted)">
        Local diagnostic ring buffer (max 500 entries). Export for support or debugging.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            diagnosticLog.info("Manual diagnostics sample");
            refresh();
          }}
        >
          Add sample entry
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            clearDiagnostics();
            refresh();
          }}
        >
          Clear
        </Button>
        <Button
          type="button"
          onClick={() => {
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "ai-web-feeds-diagnostics.json";
            anchor.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download JSON
        </Button>
      </div>

      <pre className="mt-6 max-h-[28rem] overflow-auto rounded-lg border border-(--line) bg-(--surface) p-4 text-xs">
        {json}
      </pre>
    </div>
  );
}
