import { setReaderShortcutsEnabled } from "@/hooks/use-reader-shortcuts";

const activeOverlays = new Set<string>();

function syncShortcutsEnabled(): void {
  setReaderShortcutsEnabled(activeOverlays.size === 0);
}

export function registerShortcutOverlay(id: string): () => void {
  activeOverlays.add(id);
  syncShortcutsEnabled();
  return () => {
    activeOverlays.delete(id);
    syncShortcutsEnabled();
  };
}

/** Test-only: reset overlay registry between cases. */
export function resetShortcutOverlaysForTests(): void {
  activeOverlays.clear();
  syncShortcutsEnabled();
}
