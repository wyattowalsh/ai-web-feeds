import { ContentCardSkeleton } from "@/components/ui/content-card-skeleton";

export default function FeedsLoading() {
  return (
    <div className="page-wrap page-stack">
      <section className="surface-panel space-y-8" aria-busy="true" aria-live="polite">
        <div className="space-y-3">
          <p className="metric-label">Feeds workspace</p>
          <h1 className="text-title-large font-semibold text-(--ink)">Loading feeds</h1>
          <p className="hero-copy max-w-2xl">
            Preparing the reader stream and source catalog from the local article snapshot.
          </p>
        </div>
        <ContentCardSkeleton count={4} />
      </section>
    </div>
  );
}
