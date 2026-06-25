"use client";

import Link from "next/link";
import { useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import type { SavedReaderFilter } from "@/hooks/use-saved-reader-filters";

export type SavedReaderFiltersProps = {
  variant?: "desktop" | "mobile";
  userId: string | null;
  filters: SavedReaderFilter[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  canSave: boolean;
  onSave: (filterName: string) => void | Promise<void>;
  onLoad: (filter: SavedReaderFilter) => void;
  onDelete: (filterId: string) => void | Promise<void>;
};

function summarizePayload(filter: SavedReaderFilter): string {
  const parts: string[] = [];
  const { payload } = filter;

  if (payload.query) {
    parts.push(`"${payload.query}"`);
  }
  if (payload.readerView !== "latest") {
    parts.push(payload.readerView);
  }
  if (payload.topics.length > 0) {
    parts.push(`${payload.topics.length} topic${payload.topics.length === 1 ? "" : "s"}`);
  }
  if (payload.feedIds.length > 0) {
    parts.push(`${payload.feedIds.length} feed${payload.feedIds.length === 1 ? "" : "s"}`);
  }
  if (payload.sourceType) {
    parts.push(payload.sourceType);
  }

  return parts.length > 0 ? parts.join(" · ") : "Default reader view";
}

export function SavedReaderFilters({
  variant = "desktop",
  userId,
  filters,
  loading,
  saving,
  error,
  canSave,
  onSave,
  onLoad,
  onDelete,
}: SavedReaderFiltersProps) {
  const [filterName, setFilterName] = useState("");
  const isDesktop = variant === "desktop";
  const nameInputId = isDesktop ? "reader-saved-filter-name" : "reader-saved-filter-name-mobile";

  const handleSave = async () => {
    const trimmedName = filterName.trim();
    if (!trimmedName) {
      return;
    }

    await onSave(trimmedName);
    setFilterName("");
  };

  const handleDelete = async (filterId: string) => {
    if (!confirm("Delete this saved filter preset?")) {
      return;
    }

    await onDelete(filterId);
  };

  return (
    <div
      className={cn(
        "surface-card border-(--line) bg-(--surface) p-4",
        isDesktop ? "hidden xl:block" : "xl:hidden",
      )}
      data-testid={isDesktop ? "reader-saved-filters-desktop" : "reader-saved-filters-mobile"}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-(--brand-soft) text-(--brand-strong)">
            <Bookmark className="size-4" />
          </span>
          <div>
            <p className="metric-label">Saved presets</p>
            <p className="small-note">Reuse reader focus combinations.</p>
          </div>
        </div>
      </div>

      {!userId ? (
        <div className="mt-4 rounded-2xl border border-dashed border-(--line) px-4 py-5 text-center">
          <p className="text-sm font-semibold text-(--ink)">Sign in to save presets</p>
          <p className="mt-1 text-xs text-(--ink-muted)">
            Create an account to keep filter combinations across sessions.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
            <Link href="/login?next=%2Freader">Sign in</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor={nameInputId} className="metric-label">
              Save current filters
            </label>
            <div className="flex gap-2">
              <Input
                id={nameInputId}
                value={filterName}
                onChange={(event) => setFilterName(event.target.value)}
                placeholder="Preset name"
                disabled={saving || !canSave}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSave();
                  }
                }}
              />
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !canSave || !filterName.trim()}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
            {!canSave ? (
              <p className="small-note text-(--ink-muted)">
                Apply at least one filter before saving a preset.
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="text-xs font-medium text-(--danger-tone)" role="alert">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-2xl bg-(--surface-muted)" />
              ))}
            </div>
          ) : filters.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-(--line) px-4 py-5 text-center text-(--ink-muted)">
              <p className="text-sm font-semibold text-(--ink)">No saved presets yet</p>
              <p className="mt-1 text-xs">Save the current reader filters to reload them later.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filters.map((filter) => (
                <div
                  key={filter.id}
                  className="group flex items-start justify-between gap-2 rounded-2xl border border-(--line) bg-(--surface) p-3 transition duration-150 hover:bg-(--surface-muted)"
                >
                  <button
                    type="button"
                    onClick={() => onLoad(filter)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-semibold text-(--ink)">
                      {filter.filter_name}
                    </p>
                    <p className="mt-1 truncate text-xs text-(--ink-muted)">
                      {summarizePayload(filter)}
                    </p>
                  </button>
                  <Button
                    type="button"
                    onClick={() => void handleDelete(filter.id)}
                    variant="ghost"
                    size="icon"
                    className="shrink-0 opacity-70 group-hover:opacity-100"
                    title="Delete preset"
                    aria-label={`Delete ${filter.filter_name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
