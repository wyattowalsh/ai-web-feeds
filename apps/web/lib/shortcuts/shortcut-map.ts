/**
 * Shortcut map utilities — customization, import/export, and display helpers.
 */

import {
  SHORTCUT_DESCRIPTIONS,
  formatKey,
  shortcutManager,
  type ShortcutAction,
} from "@/lib/keyboard-shortcuts";
import { preferences } from "@/lib/db";

export type ShortcutMapEntry = {
  action: ShortcutAction;
  key: string;
  description: string;
};

export type ShortcutMapExport = {
  version: 1;
  exportedAt: number;
  shortcuts: Record<string, ShortcutAction>;
};

export function listShortcutMap(): ShortcutMapEntry[] {
  const map = shortcutManager.getShortcuts();
  const byAction = new Map<ShortcutAction, string>();

  for (const [key, action] of map.entries()) {
    if (!byAction.has(action)) {
      byAction.set(action, key);
    }
  }

  return (Object.keys(SHORTCUT_DESCRIPTIONS) as ShortcutAction[]).map((action) => ({
    action,
    key: byAction.get(action) ?? "—",
    description: SHORTCUT_DESCRIPTIONS[action],
  }));
}

export async function exportShortcutMap(): Promise<ShortcutMapExport> {
  const prefs = await preferences.get();
  const shortcuts = Object.fromEntries(
    Object.entries(prefs.keyboardShortcuts).filter((entry): entry is [string, ShortcutAction] =>
      isShortcutAction(entry[1]),
    ),
  );
  return {
    version: 1,
    exportedAt: Date.now(),
    shortcuts,
  };
}

function isShortcutAction(value: string): value is ShortcutAction {
  return value in SHORTCUT_DESCRIPTIONS;
}

export function parseShortcutMapExport(raw: string): ShortcutMapExport {
  const parsed = JSON.parse(raw) as Partial<ShortcutMapExport>;
  if (parsed.version !== 1 || !parsed.shortcuts) {
    throw new Error("Invalid shortcut map export");
  }
  return {
    version: 1,
    exportedAt: parsed.exportedAt ?? Date.now(),
    shortcuts: parsed.shortcuts,
  };
}

export async function importShortcutMap(bundle: ShortcutMapExport): Promise<void> {
  await preferences.update({ keyboardShortcuts: bundle.shortcuts });
  await shortcutManager.reloadShortcuts();
}

export async function resetShortcutMap(): Promise<void> {
  await preferences.update({ keyboardShortcuts: {} });
  await shortcutManager.reloadShortcuts();
}

export function downloadShortcutMap(bundle: ShortcutMapExport): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "ai-web-feeds-shortcuts.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export { formatKey, SHORTCUT_DESCRIPTIONS, type ShortcutAction };
