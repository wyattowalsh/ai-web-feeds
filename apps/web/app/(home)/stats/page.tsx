"use client";

import { useEffect, useMemo, useState } from "react";

import { articles, readingHistory } from "@/lib/db";

type StatsSnapshot = {
  totalArticles: number;
  readArticles: number;
  starredArticles: number;
  articlesToday: number;
  readingMinutes: number;
  topTopics: Array<{ topic: string; count: number }>;
  streakDays: number;
};

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function computeStreak(timestamps: number[]): number {
  if (timestamps.length === 0) return 0;
  const days = new Set(timestamps.map((ts) => startOfDay(ts)));
  let streak = 0;
  let cursor = startOfDay(Date.now());
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 86_400_000;
  }
  return streak;
}

export default function ReadingStatsPage() {
  const [stats, setStats] = useState<StatsSnapshot | null>(null);

  useEffect(() => {
    void (async () => {
      const [allArticles, history] = await Promise.all([
        articles.getAll(),
        readingHistory.getAll(),
      ]);
      const todayStart = startOfDay(Date.now());
      const topicCounts = new Map<string, number>();

      for (const article of allArticles) {
        for (const topic of article.topics ?? []) {
          topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
        }
      }

      const topTopics = [...topicCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([topic, count]) => ({ topic, count }));

      setStats({
        totalArticles: allArticles.length,
        readArticles: allArticles.filter((a) => a.read).length,
        starredArticles: allArticles.filter((a) => a.starred).length,
        articlesToday: allArticles.filter((a) => a.pubDate >= todayStart).length,
        readingMinutes: Math.round(history.reduce((sum, entry) => sum + entry.duration, 0) / 60),
        topTopics,
        streakDays: computeStreak(history.map((entry) => entry.timestamp)),
      });
    })();
  }, []);

  const cards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "Cached articles", value: stats.totalArticles },
      { label: "Read", value: stats.readArticles },
      { label: "Starred", value: stats.starredArticles },
      { label: "Published today", value: stats.articlesToday },
      { label: "Reading time", value: `${stats.readingMinutes} min` },
      { label: "Active streak", value: `${stats.streakDays} days` },
    ];
  }, [stats]);

  return (
    <div className="page-wrap page-stack py-8">
      <h1 className="text-3xl font-semibold text-(--ink)">Reading statistics</h1>
      <p className="mt-2 max-w-2xl text-sm text-(--ink-muted)">
        Local analytics from IndexedDB — articles read, time spent, topics, and streaks.
      </p>

      {!stats ? (
        <p className="mt-6 text-sm text-(--ink-muted)">Loading stats…</p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <div
                key={card.label}
                className="rounded-lg border border-(--line) bg-(--surface) px-4 py-3"
              >
                <div className="text-xs uppercase tracking-wide text-(--ink-muted)">
                  {card.label}
                </div>
                <div className="mt-1 text-2xl font-semibold text-(--ink)">{card.value}</div>
              </div>
            ))}
          </div>

          <section className="mt-8">
            <h2 className="text-lg font-medium text-(--ink)">Top topics</h2>
            <ul className="mt-3 divide-y divide-(--line) rounded-lg border border-(--line) bg-(--surface)">
              {stats.topTopics.length === 0 ? (
                <li className="px-4 py-3 text-sm text-(--ink-muted)">No topic data yet.</li>
              ) : (
                stats.topTopics.map((row) => (
                  <li key={row.topic} className="flex justify-between px-4 py-2 text-sm">
                    <span className="text-(--ink)">{row.topic}</span>
                    <span className="text-(--ink-muted)">{row.count}</span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
