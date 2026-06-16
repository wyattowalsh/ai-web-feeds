"use client";

import * as React from "react";
import { useState } from "react";
import { Download, Upload, X, FileJson, AlertTriangle, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { exportJSON, downloadBlob, type ExportData } from "@/lib/export";
import { importJSON, type ImportResult } from "@/lib/import";

import {
  hydrateArticleStates,
  loadArticleStatesFromIDB,
  saveArticleStatesToIDB,
  type ReaderArticleState,
} from "@/lib/reader/hydrate-article-state";
import { preferences as preferencesStore, DEFAULT_PREFERENCES, type Preferences } from "@/lib/db";

export interface ImportExportSheetProps {
  /** Optional trigger element. If omitted, a default button is rendered. */
  trigger?: React.ReactNode;
  /** Called after a successful import (with counts). */
  onImported?: (result: ImportResult) => void;
  /** Called after a successful export. */
  onExported?: (kind: "full" | "reader-states") => void;
}

type ReaderPrefs = Omit<
  Preferences,
  "id" | "updatedAt" | "keyboardShortcuts" | "offlineMode" | "syncOnStartup"
> & {
  keyboardShortcuts?: Record<string, string>;
};

type ReaderStatesPayload = {
  version: string;
  exportedAt: number;
  preferences?: ReaderPrefs;
  articleStates?: Record<string, ReaderArticleState>;
};

/**
 * ImportExportSheet
 *
 * Slide-in sheet for exporting/importing:
 * - Full data (articles, feeds, folders, history, annotations, preferences) via existing lib/export + lib/import
 * - Reader-specific slice (preferences relevant to reader + article states) as a compact JSON
 *
 * The reader slice is useful for backing up triage (read/starred/archived/bookmarked) and
 * reading settings without exporting the entire cached corpus.
 */
export function ImportExportSheet({ trigger, onImported, onExported }: ImportExportSheetProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "export-full" | "export-reader" | "import">(null);
  const [status, setStatus] = useState<null | { kind: "ok" | "err"; message: string }>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const closeWithReset = () => {
    setOpen(false);
    // slight delay to allow sheet close animation before clearing transient UI state
    setTimeout(() => {
      setStatus(null);
      setBusy(null);
    }, 200);
  };

  const handleExportFull = async () => {
    setBusy("export-full");
    setStatus(null);
    try {
      const blob = await exportJSON();
      const ts = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `aiwebfeeds-full-${ts}.json`);
      setStatus({ kind: "ok", message: "Full backup downloaded." });
      onExported?.("full");
    } catch (e) {
      setStatus({ kind: "err", message: e instanceof Error ? e.message : "Export failed." });
    } finally {
      setBusy(null);
    }
  };

  const handleExportReader = async () => {
    setBusy("export-reader");
    setStatus(null);
    try {
      const prefs = await preferencesStore.get();
      const articleStates = await loadArticleStatesFromIDB();

      const readerPrefs: ReaderPrefs | undefined = prefs
        ? {
            theme: prefs.theme,
            fontSize: prefs.fontSize,
            fontFamily: prefs.fontFamily,
            readingWidth: prefs.readingWidth,
            layout: prefs.layout,
            showImages: prefs.showImages,
            showSummaries: prefs.showSummaries,
            markAsReadOnScroll: prefs.markAsReadOnScroll,
            keyboardShortcuts: prefs.keyboardShortcuts,
          }
        : undefined;

      const payload: ReaderStatesPayload = {
        version: "reader-states-1",
        exportedAt: Date.now(),
        preferences: readerPrefs,
        articleStates: Object.keys(articleStates || {}).length > 0 ? articleStates : undefined,
      };

      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const ts = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `aiwebfeeds-reader-${ts}.json`);

      setStatus({ kind: "ok", message: "Reader preferences and article states exported." });
      onExported?.("reader-states");
    } catch (e) {
      setStatus({ kind: "err", message: e instanceof Error ? e.message : "Export failed." });
    } finally {
      setBusy(null);
    }
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (file: File) => {
    setBusy("import");
    setStatus(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text) as Partial<ExportData> & Partial<ReaderStatesPayload>;

      // Detect reader-states payload
      const isReaderStates =
        data &&
        typeof data === "object" &&
        (data as ReaderStatesPayload).version?.startsWith?.("reader-states");

      if (isReaderStates) {
        const payload = data as ReaderStatesPayload;

        // Import reader prefs subset into preferences store (merge)
        if (payload.preferences) {
          const current = await preferencesStore.get();
          const merged: Preferences = {
            ...(current ?? DEFAULT_PREFERENCES),
            ...payload.preferences,
            id: "user_prefs",
            updatedAt: Date.now(),
          } as Preferences;
          await preferencesStore.put(merged);
        }

        // Import article states into IDB (merge)
        if (payload.articleStates && typeof payload.articleStates === "object") {
          await saveArticleStatesToIDB(payload.articleStates);
        }

        const counts = {
          ...(payload.preferences ? { preferences: 1 } : {}),
          ...(payload.articleStates
            ? { articleStates: Object.keys(payload.articleStates).length }
            : {}),
        } as ImportResult["counts"];

        const result: ImportResult = {
          success: true,
          counts,
          errors: [],
        };

        setStatus({ kind: "ok", message: "Reader settings imported." });
        onImported?.(result);
        // Also run a hydration pass to keep localStorage in sync if anything lingered
        void hydrateArticleStates({ clearLocalStorage: false });
      } else {
        // Fall back to full JSON import path
        const fileForImport = new File([JSON.stringify(data)], file.name, {
          type: "application/json",
        });
        const result = await importJSON(fileForImport, { mergeStrategy: "merge" });
        if (result.success) {
          setStatus({ kind: "ok", message: "Data imported successfully." });
        } else {
          setStatus({
            kind: "err",
            message: result.errors?.length
              ? result.errors.join("; ")
              : "Import completed with issues.",
          });
        }
        onImported?.(result);
      }
    } catch (e) {
      setStatus({ kind: "err", message: e instanceof Error ? e.message : "Import failed." });
    } finally {
      setBusy(null);
      // Reset the input so selecting the same file again works
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (f) void handleImportFile(f);
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-2">
      <Download className="size-4" />
      Import / Export
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger ?? defaultTrigger}</SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Import / Export</SheetTitle>
          <SheetDescription>
            Back up or restore your reader preferences and article states. Full data export includes
            your cached articles and feeds.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          {/* Export section */}
          <div className="rounded-lg border border-(--line) bg-(--surface) p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Download className="size-4" />
              Export
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                className="justify-start gap-2"
                onClick={handleExportFull}
                disabled={!!busy}
              >
                <FileJson className="size-4" />
                Export full data (JSON)
              </Button>
              <Button
                variant="secondary"
                className="justify-start gap-2"
                onClick={handleExportReader}
                disabled={!!busy}
              >
                <FileJson className="size-4" />
                Export reader prefs + states (JSON)
              </Button>
            </div>
            <p className="mt-2 text-xs text-(--ink-muted)">
              Reader export is a compact file with your reading settings and per-article triage
              (read/starred/archived/bookmarked).
            </p>
          </div>

          {/* Import section */}
          <div className="rounded-lg border border-(--line) bg-(--surface) p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Upload className="size-4" />
              Import
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={triggerImport}
                disabled={!!busy}
              >
                <Upload className="size-4" />
                Choose JSON file…
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={onFileChange}
              />
            </div>
            <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Imports merge by default. Full data imports can add/replace articles, feeds, and
                preferences. Reader-state imports update your triage and settings only.
              </span>
            </div>
          </div>

          {/* Status */}
          {status && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border p-3 text-sm",
                status.kind === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
                  : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200",
              )}
            >
              {status.kind === "ok" ? (
                <Check className="size-4" />
              ) : (
                <AlertTriangle className="size-4" />
              )}
              <span>{status.message}</span>
            </div>
          )}
        </div>

        <SheetFooter>
          <SheetClose asChild>
            <Button variant="ghost" className="gap-2" onClick={closeWithReset}>
              <X className="size-4" />
              Close
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default ImportExportSheet;
