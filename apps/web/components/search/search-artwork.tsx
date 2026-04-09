import { cn } from "@/lib/cn";

type SearchArtworkConfig = {
  title: string;
  caption: string;
  accent: string;
};

type SearchArtworkSlotProps = SearchArtworkConfig & {
  className?: string;
  priority?: boolean;
  sizes?: string;
};

export const SEARCH_ARTWORKS = {
  startHereOnboarding: {
    title: "Find sources, then scan fresh posts",
    caption:
      "Start with source search, switch to article search once you have the right feed cluster.",
    accent: "from-sky-500/15 via-cyan-500/10 to-emerald-500/15",
  },
  modesComparison: {
    title: "Two search modes, one catalog",
    caption:
      "Source search ranks the registry. Article search fans out into recent posts from the strongest matches.",
    accent: "from-amber-500/15 via-rose-500/10 to-sky-500/15",
  },
  noResults: {
    title: "No match in the current slice",
    caption: "Broaden the query or remove filters to search a wider slice of the catalog.",
    accent: "from-slate-500/15 via-zinc-500/10 to-sky-500/15",
  },
} as const satisfies Record<string, SearchArtworkConfig>;

export function SearchArtworkSlot({ title, caption, accent, className }: SearchArtworkSlotProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[2rem] border border-(--line) bg-linear-to-br p-6",
        accent,
        className,
      )}
    >
      <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div className="space-y-3">
          <p className="metric-label">Search flow</p>
          <h3 className="text-xl font-semibold text-(--ink)">{title}</h3>
          <p className="small-note max-w-xl">{caption}</p>
        </div>

        <div className="grid gap-3 rounded-[1.5rem] border border-(--line) bg-(--surface)/85 p-4 shadow-sm">
          <div className="rounded-2xl border border-(--line) bg-(--surface-muted) p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--ink-muted)">
              Source search
            </p>
            <p className="mt-2 text-sm text-(--ink)">
              Find the right publication, topic cluster, or provider.
            </p>
          </div>
          <div className="rounded-2xl border border-(--line) bg-(--surface-muted) p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--ink-muted)">
              Article search
            </p>
            <p className="mt-2 text-sm text-(--ink)">
              Pull recent posts from the strongest candidate feeds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
