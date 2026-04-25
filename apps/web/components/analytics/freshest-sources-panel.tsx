"use client";

import { useEffect, useState } from "react";

interface FreshSource {
  feed_id: string;
  title: string;
  source_url: string;
  latest_post_at: string | null;
  recent_post_count: number;
}

interface SummaryPayload {
  freshest_sources: FreshSource[];
}

export function FreshestSourcesPanel({
  dateRange = "30d",
  topic,
}: {
  dateRange?: string;
  topic?: string;
}) {
  const [sources, setSources] = useState<FreshSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      try {
        const params = new URLSearchParams({ date_range: dateRange });
        if (topic) params.set("topic", topic);
        const response = await fetch(`/api/analytics/summary?${params}`);
        if (!response.ok) {
          throw new Error("Failed to load freshest sources");
        }

        const payload = (await response.json()) as SummaryPayload;
        setSources(Array.isArray(payload.freshest_sources) ? payload.freshest_sources : []);
      } catch (error) {
        console.error(error);
        setSources([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [dateRange, topic]);

  return (
    <section className="surface-card space-y-4">
      <div className="space-y-2">
        <span className="eyebrow">Freshness</span>
        <h2 className="text-title-medium">Freshest sources in the current live scan</h2>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-2xl bg-[color:var(--surface-muted)]"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => (
            <a
              key={source.feed_id}
              href={source.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3 transition duration-150 hover:bg-[color:var(--surface-muted)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--ink)]">{source.title}</p>
                  <p className="small-note">
                    {source.latest_post_at
                      ? new Date(source.latest_post_at).toLocaleString()
                      : "No recent timestamp"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="metric-label">Recent posts</p>
                  <p className="text-lg font-semibold text-[color:var(--brand-strong)]">
                    {source.recent_post_count}
                  </p>
                </div>
              </div>
            </a>
          ))}

          {sources.length === 0 && (
            <p className="small-note">
              No recent source activity was available for this filter set.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
