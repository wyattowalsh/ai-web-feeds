"use client";

import { useEffect } from "react";

import { registerShortcutOverlay } from "@/lib/reader/shortcut-overlay-registry";

export function useSuspendReaderShortcuts(id: string, active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }

    return registerShortcutOverlay(id);
  }, [id, active]);
}
