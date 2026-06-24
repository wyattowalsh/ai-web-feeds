"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpenText, Clock3 } from "lucide-react";

import { buildImmersiveReaderHref } from "@/lib/reader/reader-href";
import { getCachedArticles } from "@/lib/offline/offline-sync";
import type { Article } from "@/lib/db";

function formatCachedAt(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function OfflineFeedView() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const cached = await getCachedArticles();
        const sorted = [...cached].sort((a, b) => (b.cachedAt || 0) - (a.cachedAt || 0));
        if (!cancelled) setArticles(sorted);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-[color:var(--ink-muted)]">Loading cached articles…</p>;
  }

  if (articles.length === 0) {
    return (
      <p className="text-sm text-[color:var(--ink-muted)]">
        No articles saved for offline reading yet. Open the reader while online and cache content
        first.
      </p>
    );
  }

  return (
    <section className="mx-auto w-full max-w-2xl text-left">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-(--ink)">Saved for offline</h2>
        <span className="text-xs uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
          {articles.length} cached
        </span>
      </div>

      <ul className="mt-4 divide-y divide-(--line) rounded-lg border border-(--line) bg-(--surface)">
        {articles.map((article) => (
          <li key={article.id}>
            <Link
              href={buildImmersiveReaderHref({
                id: article.id,
                title: article.title,
                link: article.link,
              })}
              className="flex items-start gap-3 px-4 py-3 transition hover:bg-(--surface-muted)"
            >
              <BookOpenText className="mt-0.5 size-4 shrink-0 text-(--ink-muted)" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-(--ink)">{article.title}</div>
                <p className="mt-1 flex items-center gap-1 text-xs text-[color:var(--ink-muted)]">
                  <Clock3 className="size-3.5" aria-hidden />
                  Cached {formatCachedAt(article.cachedAt)}
                  {article.read ? " · Read" : ""}
                  {article.starred ? " · Starred" : ""}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
