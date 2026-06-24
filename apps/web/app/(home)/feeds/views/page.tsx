"use client";

import { useState } from "react";

import { FolderTree } from "@/components/organization/folder-tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  loadCustomViews,
  upsertCustomView,
  type CustomView,
} from "@/lib/organization/custom-view-schema";

export default function CustomViewsPage() {
  const [views, setViews] = useState<CustomView[]>(() => loadCustomViews());
  const [name, setName] = useState("Today's Reading");

  const handleSaveView = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = Date.now();
    const view: CustomView = {
      id: `view_${now}`,
      name: trimmed,
      filters: { readStatus: "unread" },
      layout: "cards",
      createdAt: now,
      updatedAt: now,
    };
    setViews(upsertCustomView(view));
  };

  return (
    <div className="page-wrap page-stack py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-(--ink)">Feed organization</h1>
        <p className="max-w-2xl text-sm text-(--ink-muted)">
          Create folders and saved views. State persists locally in IndexedDB and localStorage.
        </p>
      </header>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-(--ink)">Folders</h2>
          <FolderTree />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-(--ink)">Custom views</h2>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="View name" />
            <Button type="button" onClick={handleSaveView}>
              Save view
            </Button>
          </div>
          <ul className="divide-y divide-(--line) rounded-lg border border-(--line) bg-(--surface)">
            {views.length === 0 ? (
              <li className="px-4 py-3 text-sm text-(--ink-muted)">No saved views yet.</li>
            ) : (
              views.map((view) => (
                <li key={view.id} className="px-4 py-3 text-sm">
                  <div className="font-medium text-(--ink)">{view.name}</div>
                  <div className="text-(--ink-muted)">Layout: {view.layout}</div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
