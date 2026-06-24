"use client";

import { useEffect, useState } from "react";

import { ExtensionBridge } from "./extension-bridge";
import { loadExtensionQueue, type ExtensionQueueItem } from "@/lib/extension/message-handler";

export default function ReadingListPage() {
  const [queue, setQueue] = useState<ExtensionQueueItem[]>([]);

  useEffect(() => {
    setQueue(loadExtensionQueue());
  }, []);

  return (
    <div className="page-wrap page-stack py-8">
      <ExtensionBridge />
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-(--ink)">Reading list queue</h1>
        <p className="text-sm text-(--ink-muted)">
          Articles and feeds saved from the browser extension appear here until applied locally.
        </p>
      </header>

      <ul className="divide-y divide-(--line) rounded-lg border border-(--line) bg-(--surface)">
        {queue.length === 0 ? (
          <li className="px-4 py-6 text-sm text-(--ink-muted)">Queue is empty.</li>
        ) : (
          queue.map((item) => (
            <li key={item.id} className="px-4 py-3 text-sm">
              <div className="font-medium text-(--ink)">{item.type}</div>
              <div className="text-(--ink-muted)">
                {String(item.payload.url ?? item.payload.feedUrl ?? "—")}
              </div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-(--ink-muted)">
                {item.status} · {new Date(item.receivedAt).toLocaleString()}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
