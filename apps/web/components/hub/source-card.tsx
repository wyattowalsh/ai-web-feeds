import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { SourceAvatar } from "@/components/source-avatar";
import { cn } from "@/lib/cn";
import type { HubSourceSummary } from "@/lib/hub/types";

type SourceCardProps = {
  source: HubSourceSummary;
  className?: string;
};

export function SourceCard({ source, className }: SourceCardProps) {
  return (
    <Link
      href={source.href}
      className={cn(
        "surface-card group flex flex-col gap-3 transition hover:border-primary/30 hover:bg-muted/30",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <SourceAvatar source={{ title: source.title }} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">{source.title}</h3>
            {source.verified ? (
              <ShieldCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : null}
          </div>
          {source.sourceType ? (
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {source.sourceType}
            </p>
          ) : null}
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      {source.description ? (
        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{source.description}</p>
      ) : null}
      {typeof source.topicCount === "number" ? (
        <p className="text-xs text-muted-foreground">{source.topicCount} topics</p>
      ) : null}
    </Link>
  );
}
