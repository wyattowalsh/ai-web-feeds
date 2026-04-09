"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { OpmlPreviewData } from "@/lib/opml-preview";

import { OPMLViewer } from "./opml-viewer";

export function AdvancedPreviewSection({ preview }: { preview: OpmlPreviewData }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section id="opml-viewer" className="mb-8 rounded-2xl border bg-card p-6 scroll-mt-24">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start">
        <div>
          <div className="mb-2 inline-flex items-center rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Optional advanced preview
          </div>
          <h2 className="text-2xl font-semibold">Preview Before You Import</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Keep the downloads page lightweight by opening the inspector only when you need to
            browse folder structure, spot-check one source, or compare a small merged timeline.
          </p>
        </div>

        <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Best for:</p>
          <ul className="mt-2 space-y-2">
            <li>Checking that a full-catalog bundle has the feeds you expect</li>
            <li>Spot-checking a source before importing it</li>
            <li>Scanning one recent timeline across visible feeds</li>
          </ul>
        </div>
      </div>

      {!isOpen ? (
        <div className="mt-6 rounded-xl border border-dashed bg-muted/20 p-5">
          <p className="text-sm text-muted-foreground">
            The preview stays hidden by default so this page remains a fast export surface.
          </p>
          <div className="mt-4">
            <Button onClick={() => setIsOpen(true)}>Open advanced preview</Button>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Advanced preview is open. Hide it again when you are done inspecting the export.
            </p>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Hide preview
            </Button>
          </div>
          <OPMLViewer preview={preview} />
        </div>
      )}
    </section>
  );
}
