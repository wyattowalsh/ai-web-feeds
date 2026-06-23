import Link from "next/link";
import { Hash } from "lucide-react";
import { cn } from "@/lib/cn";
import type { HubTopicSummary } from "@/lib/hub/types";

type TopicCardProps = {
  topic: HubTopicSummary;
  className?: string;
};

export function TopicCard({ topic, className }: TopicCardProps) {
  const readerHref = `/reader?topics=${encodeURIComponent(topic.id)}`;

  return (
    <div
      className={cn(
        "surface-card-soft group flex flex-col gap-2 transition hover:border-primary/30",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-background">
          <Hash className="size-4 text-primary" />
        </span>
        <Link
          href={topic.href}
          className="text-base font-semibold text-foreground group-hover:text-primary hover:underline"
        >
          {topic.label}
        </Link>
      </div>
      {topic.description ? (
        <p className="text-sm leading-6 text-muted-foreground">{topic.description}</p>
      ) : null}
      {typeof topic.articleCount === "number" ? (
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {topic.articleCount} articles
        </p>
      ) : null}
      <div className="pt-1">
        <Link
          href={readerHref}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Open in reader
        </Link>
      </div>
    </div>
  );
}
