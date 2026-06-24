"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  downloadShortcutMap,
  exportShortcutMap,
  formatKey,
  importShortcutMap,
  listShortcutMap,
  parseShortcutMapExport,
  resetShortcutMap,
  type ShortcutMapEntry,
} from "@/lib/shortcuts/shortcut-map";
import { shortcutManager, type ShortcutAction } from "@/lib/keyboard-shortcuts";

export default function ShortcutSettingsPage() {
  const [entries, setEntries] = useState<ShortcutMapEntry[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = () => setEntries(listShortcutMap());

  useEffect(() => {
    refresh();
  }, []);

  const handleKeyChange = async (action: ShortcutAction, key: string) => {
    const trimmed = key.trim();
    if (!trimmed) return;
    await shortcutManager.updateShortcut(action, trimmed);
    refresh();
    setStatus(`Updated ${action}`);
  };

  return (
    <div className="page-wrap page-stack py-8">
      <h1 className="text-3xl font-semibold text-(--ink)">Keyboard shortcuts</h1>
      <p className="mt-2 max-w-2xl text-sm text-(--ink-muted)">
        Customize reader shortcuts. Changes persist in IndexedDB preferences.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => void exportShortcutMap().then(downloadShortcutMap)}
        >
          Export map
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void resetShortcutMap().then(refresh)}
        >
          Reset defaults
        </Button>
        <label className="inline-flex cursor-pointer items-center rounded-md border border-(--line) px-3 py-2 text-sm">
          Import map
          <input
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file.text().then(async (raw) => {
                await importShortcutMap(parseShortcutMapExport(raw));
                refresh();
                setStatus("Imported shortcut map");
              });
            }}
          />
        </label>
      </div>

      {status ? <p className="mt-3 text-sm text-(--ink-muted)">{status}</p> : null}

      <ul className="mt-6 divide-y divide-(--line) rounded-lg border border-(--line) bg-(--surface)">
        {entries.map((entry) => (
          <li
            key={entry.action}
            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="font-medium text-(--ink)">{entry.description}</div>
              <div className="text-xs text-(--ink-muted)">{entry.action}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="min-w-[3rem] rounded bg-(--surface-muted) px-2 py-1 text-center text-sm font-mono">
                {formatKey(entry.key)}
              </span>
              <Input
                aria-label={`Shortcut for ${entry.description}`}
                className="w-28 font-mono text-sm"
                defaultValue={entry.key}
                onBlur={(event) => void handleKeyChange(entry.action, event.target.value)}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
