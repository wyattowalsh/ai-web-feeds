"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { AdvancedSearchPanel, type SearchFilters } from "@/components/search/advanced-search-panel";
import { articles } from "@/lib/db";
import { useSearchWorker } from "@/hooks/use-search-worker";
import { buildImmersiveReaderHref } from "@/lib/reader/reader-href";
import { tokenizeQuery } from "@/lib/search/tokenize";

function highlight(text: string, terms: string[]): ReactNode {
  if (!terms.length) return text;
  const pattern = new RegExp(
    `(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );
  const parts = text.split(pattern);
  return parts.map((part, index) =>
    pattern.test(part) ? (
      <mark
        key={`${part}-${index}`}
        className="rounded bg-amber-200/60 px-0.5 text-inherit dark:bg-amber-500/30"
      >
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

export function CachedSearchResults({ initialQuery = "" }: { initialQuery?: string }) {
  const { ready, building, query, lastElapsedMs } = useSearchWorker();
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<
    Array<{ id: string; title: string; summary?: string; score: number }>
  >([]);
  const [activeQuery, setActiveQuery] = useState(initialQuery);

  const terms = useMemo(() => tokenizeQuery(activeQuery), [activeQuery]);

  const runSearch = useCallback(
    async (q: string, filters: SearchFilters) => {
      if (!ready) return;
      setLoading(true);
      setActiveQuery(q);
      try {
        const result = await query(q, 40);
        const articleMap = new Map((await articles.getAll()).map((a) => [a.id, a]));
        const rows = result.hits
          .map((hit) => {
            const article = articleMap.get(hit.id);
            if (!article) return null;
            if (filters.unreadOnly && article.read) return null;
            if (filters.starredOnly && !article.starred) return null;
            if (filters.topics.length > 0) {
              const topics = [...article.topics, ...article.sourceTopics];
              if (!filters.topics.some((t) => topics.includes(t))) return null;
            }
            return {
              id: article.id,
              title: article.title,
              summary: article.summary,
              score: hit.score,
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null);
        setHits(rows);
      } finally {
        setLoading(false);
      }
    },
    [query, ready],
  );

  useEffect(() => {
    if (initialQuery && ready) {
      void runSearch(initialQuery, { unreadOnly: false, starredOnly: false, topics: [] });
    }
  }, [initialQuery, ready, runSearch]);

  return (
    <section className="space-y-4" aria-label="Cached article search">
      <AdvancedSearchPanel
        initialQuery={initialQuery}
        loading={loading || building}
        elapsedMs={lastElapsedMs}
        onSearch={(q, filters) => void runSearch(q, filters)}
      />

      {!ready && !building ? (
        <p className="text-sm text-(--ink-muted)">Search worker unavailable in this environment.</p>
      ) : null}

      {hits.length === 0 && activeQuery ? (
        <p className="text-sm text-(--ink-muted)">
          No cached articles matched. Save articles offline first.
        </p>
      ) : null}

      {hits.length > 0 ? (
        <ul className="divide-y divide-(--line) rounded-lg border border-(--line) bg-(--surface)">
          {hits.map((hit) => (
            <li key={hit.id}>
              <Link
                href={buildImmersiveReaderHref({ id: hit.id, title: hit.title, link: "" })}
                className="block px-4 py-3 hover:bg-(--surface-muted)"
              >
                <div className="font-medium text-(--ink)">{highlight(hit.title, terms)}</div>
                {hit.summary ? (
                  <p className="mt-1 line-clamp-2 text-sm text-(--ink-muted)">
                    {highlight(hit.summary, terms)}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-(--ink-muted)">
                  score {hit.score.toFixed(1)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
