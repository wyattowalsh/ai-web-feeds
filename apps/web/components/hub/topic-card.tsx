import Link from "next/link";
import { Hash } from "lucide-react";
import { cn } from "@/lib/cn";
import type { HubTopicSummary } from "@/lib/hub/types";

type TopicCardProps = {
  topic: HubTopicSummary;
  className?: string;
};

export function TopicCard({ topic, className }: TopicCardProps) {
  return (
    <Link
      href={topic.href}
      className={cn(
        "surface-card-soft group flex flex-col gap-2 transition hover:border-primary/30",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-background">
          <Hash className="size-4 text-primary" />
        </span>
        <h3 className="text-base font-semibold text-foreground group-hover:text-primary">
          {topic.label}
        </h3>
      </div>
      {topic.description ? (
        <p className="text-sm leading-6 text-muted-foreground">{topic.description}</p>
      ) : null}
      {typeof topic.articleCount === "number" ? (
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {topic.articleCount} articles
        </p>
      ) : null}
    </Link>
  );
}
