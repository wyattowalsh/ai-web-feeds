"use client";

import { Keyboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatKey, SHORTCUT_DESCRIPTIONS } from "@/lib/keyboard-shortcuts";
import { listReaderShortcuts } from "@/hooks/use-reader-shortcuts";

export type ReaderShortcutsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ReaderShortcutsSheet({ open, onOpenChange }: ReaderShortcutsSheetProps) {
  const shortcuts = listReaderShortcuts();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Keyboard className="size-4 text-(--ink-muted)" aria-hidden />
            Keyboard shortcuts
          </SheetTitle>
          <SheetDescription>
            Press <kbd className="rounded border px-1 text-xs">?</kbd> anytime in the reader to
            reopen this list.
          </SheetDescription>
        </SheetHeader>

        <ul className="mt-6 space-y-2">
          {shortcuts.map(({ key, action }) => (
            <li
              key={`${key}-${action}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-(--line) bg-(--surface-muted) px-3 py-2 text-sm"
            >
              <span className="text-(--ink-muted)">
                {SHORTCUT_DESCRIPTIONS[action] ?? action.replaceAll("_", " ")}
              </span>
              <kbd className="shrink-0 rounded border border-(--line) bg-(--surface) px-2 py-0.5 font-mono text-xs text-(--ink)">
                {formatKey(key)}
              </kbd>
            </li>
          ))}
        </ul>

        <SheetFooter className="mt-6">
          <SheetClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
