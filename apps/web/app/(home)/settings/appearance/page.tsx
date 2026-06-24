"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { preferences, type Preferences } from "@/lib/db";
import {
  themeManager,
  type LayoutMode,
  type ReadingWidth,
  type ThemeMode,
} from "@/lib/theme-manager";

export default function AppearanceSettingsPage() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void preferences.get().then(setPrefs);
  }, []);

  const update = async (patch: Partial<Preferences>) => {
    await preferences.update(patch);
    const next = await preferences.get();
    setPrefs(next);
    if (patch.theme) await themeManager.setTheme(patch.theme);
    setStatus("Appearance saved");
  };

  if (!prefs) {
    return <div className="page-wrap py-8 text-sm text-(--ink-muted)">Loading preferences…</div>;
  }

  return (
    <div className="page-wrap page-stack py-8">
      <h1 className="text-3xl font-semibold text-(--ink)">Appearance</h1>
      <p className="mt-2 max-w-2xl text-sm text-(--ink-muted)">
        Theme, typography, and reading layout — stored locally in IndexedDB.
      </p>

      <section className="mt-6 space-y-4 rounded-lg border border-(--line) bg-(--surface) p-4">
        <label className="block text-sm font-medium text-(--ink)">
          Theme
          <select
            className="mt-1 w-full rounded-md border border-(--line) bg-(--surface) px-3 py-2 text-sm"
            value={prefs.theme}
            onChange={(event) => void update({ theme: event.target.value as ThemeMode })}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <label className="block text-sm font-medium text-(--ink)">
          Font size ({prefs.fontSize}px)
          <input
            type="range"
            min={14}
            max={22}
            value={prefs.fontSize}
            className="mt-2 w-full"
            onChange={(event) => void update({ fontSize: Number(event.target.value) })}
          />
        </label>

        <label className="block text-sm font-medium text-(--ink)">
          Font family
          <select
            className="mt-1 w-full rounded-md border border-(--line) bg-(--surface) px-3 py-2 text-sm"
            value={prefs.fontFamily}
            onChange={(event) => void update({ fontFamily: event.target.value })}
          >
            <option value="system-ui">System UI</option>
            <option value="Georgia, serif">Serif</option>
            <option value="ui-monospace, monospace">Monospace</option>
          </select>
        </label>

        <label className="block text-sm font-medium text-(--ink)">
          Reading width
          <select
            className="mt-1 w-full rounded-md border border-(--line) bg-(--surface) px-3 py-2 text-sm"
            value={prefs.readingWidth}
            onChange={(event) => void update({ readingWidth: event.target.value as ReadingWidth })}
          >
            <option value="narrow">Narrow</option>
            <option value="medium">Medium</option>
            <option value="wide">Wide</option>
          </select>
        </label>

        <label className="block text-sm font-medium text-(--ink)">
          Layout
          <select
            className="mt-1 w-full rounded-md border border-(--line) bg-(--surface) px-3 py-2 text-sm"
            value={prefs.layout}
            onChange={(event) => void update({ layout: event.target.value as LayoutMode })}
          >
            <option value="list">List</option>
            <option value="cards">Cards</option>
            <option value="compact">Compact</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-(--ink)">
          <input
            type="checkbox"
            checked={prefs.showImages}
            onChange={(event) => void update({ showImages: event.target.checked })}
          />
          Show images in article list
        </label>

        <label className="flex items-center gap-2 text-sm text-(--ink)">
          <input
            type="checkbox"
            checked={prefs.showSummaries}
            onChange={(event) => void update({ showSummaries: event.target.checked })}
          />
          Show summaries
        </label>
      </section>

      {status ? <p className="mt-3 text-sm text-(--ink-muted)">{status}</p> : null}

      <Button
        type="button"
        className="mt-4"
        variant="secondary"
        onClick={() => void themeManager.setTheme("system")}
      >
        Sync with system theme
      </Button>
    </div>
  );
}
