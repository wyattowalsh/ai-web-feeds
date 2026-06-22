"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { FilterChip } from "@/lib/reader";

export type ReaderFilterChipBarProps = {
  chips: FilterChip[];
  onFilterChip: (overrides: Record<string, string | string[] | null | undefined>) => void;
  onResetDrafts: () => void;
};

export function ReaderFilterChipBar({
  chips,
  onFilterChip,
  onResetDrafts,
}: ReaderFilterChipBarProps) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2" data-testid="reader-active-filter-chips">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          aria-label={`Remove filter: ${chip.label}`}
          onClick={() => onFilterChip(chip.overrides)}
          className="inline-flex items-center gap-2 rounded-md border border-(--line) bg-(--surface-muted) px-2.5 py-1.5 text-xs font-semibold text-(--ink)"
        >
          {chip.label}
          <X className="size-3.5 text-(--ink-muted)" />
        </button>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={onResetDrafts}>
        Clear all
      </Button>
    </div>
  );
}
