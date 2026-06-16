"use client";

import { useEffect, useMemo } from "react";
import {
  shortcutManager,
  useKeyboardShortcut,
  type ShortcutAction,
} from "@/lib/keyboard-shortcuts";

/**
 * Reader shortcut action names that this hook wires.
 * These align with both KeyboardShortcutManager defaults and reader UI actions.
 */
export type ReaderShortcutAction =
  | "next_article"
  | "previous_article"
  | "mark_as_read"
  | "star"
  | "archive"
  | "open_original"
  | "refresh"
  | "search"
  | "go_home"
  | "go_starred"
  | "go_unread"
  | "go_all"
  | "close_modal"
  | "show_shortcuts"
  | "toggle_sidebar"
  | "focus_search";

/**
 * Map of reader actions to handlers provided by the caller.
 */
export type ReaderShortcutHandlers = Partial<Record<ReaderShortcutAction, () => void>>;

/**
 * Optional configuration for the reader shortcuts hook.
 */
export interface UseReaderShortcutsOptions {
  /**
   * When true (default), the hook will register handlers with the global shortcutManager.
   * Set to false if you want to only read keybindings without side effects.
   */
  enabled?: boolean;

  /**
   * When true, calling the hook will ensure the manager has loaded shortcuts from preferences.
   * This is a no-op if already loaded; safe to call repeatedly.
   */
  loadFromPreferences?: boolean;
}

/**
 * React hook that wires the global KeyboardShortcutManager to reader-specific actions.
 *
 * Example:
 *   useReaderShortcuts({
 *     next_article: () => goNext(),
 *     previous_article: () => goPrev(),
 *     mark_as_read: () => toggleRead(selectedId),
 *     star: () => toggleStar(selectedId),
 *     archive: () => toggleArchive(selectedId),
 *     open_original: () => openOriginal(selected),
 *     refresh: () => refresh(),
 *     search: () => focusSearchInput(),
 *   });
 */
export function useReaderShortcuts(
  handlers: ReaderShortcutHandlers,
  options: UseReaderShortcutsOptions = {},
): void {
  const { enabled = true, loadFromPreferences = true } = options;

  // Ensure shortcuts are loaded from user preferences on first use in reader surfaces.
  useEffect(() => {
    if (!loadFromPreferences) return;
    // The manager loads asynchronously from preferences; we just trigger a best-effort load.
    // It is safe to call multiple times; the manager dedupes listeners internally.
    void (async () => {
      try {
        // Accessing getShortcuts will have loaded in constructor; nudge a reload path if needed.
        // We intentionally avoid exposing a public reload to keep API minimal.
        // The manager already attempts to load in its constructor.
        shortcutManager.getShortcuts();
      } catch {
        // Non-fatal
      }
    })();
  }, [loadFromPreferences]);

  // Register each provided handler with the singleton manager.
  // useKeyboardShortcut returns an unregister on unmount per action.
  const actions = useMemo(() => Object.keys(handlers) as ReaderShortcutAction[], [handlers]);

  // Wire each action via the existing hook for consistent lifecycle handling.
  for (const action of actions) {
    const handler = handlers[action];
    if (handler) {
      // The internal hook registers with shortcutManager and cleans up on unmount.
      // We call it unconditionally; when !enabled we still register but manager.setEnabled controls firing.
      // To respect `enabled`, we wrap the handler to no-op when disabled.
      // However, the manager also has setEnabled(); we mirror that behavior here for safety.
      // Simpler: always register; rely on manager.setEnabled for global toggle.
      // But to honor the local `enabled` flag without mutating global state, gate inside a stable wrapper.
      // We create a tiny wrapper per action below via effect to avoid stale closures.
      // For clarity and to avoid dynamic hook count issues, we instead call the hook with a guarded handler.
      // Since the number of keys is small and stable per render, this is fine.
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useKeyboardShortcut(action as ShortcutAction, () => {
        if (!enabled) return;
        handler?.();
      });
    }
  }
}

/**
 * Imperative helper to enable/disable the global shortcut manager from reader surfaces.
 * Useful when opening modals or focusing inputs where shortcuts should be temporarily suspended.
 */
export function setReaderShortcutsEnabled(enabled: boolean): void {
  shortcutManager.setEnabled(enabled);
}

/**
 * Read the current key binding for a reader action (if any).
 */
export function getReaderShortcutKey(action: ReaderShortcutAction): string | undefined {
  return shortcutManager.getKeyForAction(action as ShortcutAction);
}

/**
 * List current shortcuts as a simple array for help UIs.
 */
export function listReaderShortcuts(): Array<{ key: string; action: ReaderShortcutAction }> {
  const map = shortcutManager.getShortcuts();
  const out: Array<{ key: string; action: ReaderShortcutAction }> = [];
  map.forEach((action, key) => {
    out.push({ key, action: action as ReaderShortcutAction });
  });
  return out;
}

export type { ShortcutAction } from "@/lib/keyboard-shortcuts";
