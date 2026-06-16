"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildImmersiveReaderHref } from "@/lib/reader/reader-href";
import { searchArticlesLocal, type LocalSearchResult } from "@/lib/reader/local-search";

export function OfflineCachedSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    try {
      const matches = await searchArticlesLocal(trimmed, { limit: 12 });
      setResults(matches);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <section className="mx-auto mt-12 w-full max-w-xl text-left">
      <h2 className="text-lg font-semibold tracking-tight text-(--ink)">Search cached articles</h2>
      <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
        Looks through articles stored on this device. No network required.
      </p>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch();
        }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search titles, summaries, topics…"
          aria-label="Search cached articles"
          autoComplete="off"
        />
        <Button type="submit" variant="secondary" disabled={loading || query.trim().length === 0}>
          <Search className="size-4" aria-hidden />
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      {searched ? (
        <div className="mt-4">
          {results.length === 0 ? (
            <p className="text-sm text-[color:var(--ink-muted)]">
              No cached articles matched. Open the reader while online to cache more content.
            </p>
          ) : (
            <ul className="divide-y divide-(--line) rounded-lg border border-(--line) bg-(--surface)">
              {results.map(({ article, matchedFields }) => (
                <li key={article.id}>
                  <Link
                    href={buildImmersiveReaderHref({
                      id: article.id,
                      title: article.title,
                      link: article.link,
                    })}
                    className="block px-4 py-3 transition hover:bg-(--surface-muted)"
                  >
                    <div className="font-medium text-(--ink)">{article.title}</div>
                    {article.summary ? (
                      <p className="mt-1 line-clamp-2 text-sm text-[color:var(--ink-muted)]">
                        {article.summary}
                      </p>
                    ) : null}
                    {matchedFields.length > 0 ? (
                      <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                        Matched: {matchedFields.join(", ")}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
