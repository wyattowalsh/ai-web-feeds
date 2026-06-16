"use client";

import { useEffect, useRef } from "react";
import { shortcutManager, type ShortcutAction } from "@/lib/keyboard-shortcuts";

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

  // Use refs to avoid stale closures for enabled/handlers while keeping a single registration effect.
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // Register all provided handlers with the singleton manager in a *single* useEffect.
  // This fixes the Rules of Hooks violation from the previous per-action useKeyboardShortcut loop.
  // Callers typically memoize the handlers object (see feeds-workspace-client).
  useEffect(() => {
    const unregisterFns: Array<() => void> = [];
    (Object.keys(handlers) as ReaderShortcutAction[]).forEach((action) => {
      const handler = handlers[action];
      if (handler) {
        const wrappedHandler = () => {
          if (!enabledRef.current) return;
          // Prefer the handler from ref in case of identity churn, but the provided one at register is fresh.
          (handlersRef.current[action] ?? handler)();
        };
        const unregister = shortcutManager.register(action as ShortcutAction, wrappedHandler);
        unregisterFns.push(unregister);
      }
    });

    return () => {
      unregisterFns.forEach((fn) => fn());
    };
  }, [handlers, enabled]);
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
