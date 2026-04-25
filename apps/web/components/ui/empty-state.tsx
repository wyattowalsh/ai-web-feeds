import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  media?: ReactNode;
  tips?: string[];
  media?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  media,
  tips,
  media,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div className={cn("surface-card-soft text-center", className)}>
      <div className="mb-4 flex justify-center">
        <span className="flex size-14 items-center justify-center rounded-3xl bg-(--brand-soft) text-(--brand-strong)">
          <Icon className="size-5" />
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-title-medium text-(--ink)">{title}</p>
        <p className="small-note mx-auto max-w-2xl">{description}</p>
      </div>

      {media ? <div className="mt-6">{media}</div> : null}

      {tips?.length ? (
        <div className="mt-6 grid gap-3 text-left md:grid-cols-2">
          {tips.map((tip) => (
            <div
              key={tip}
              className="rounded-3xl border border-(--line) bg-(--surface) p-4 text-sm text-(--ink-muted)"
            >
              {tip}
            </div>
          ))}
        </div>
      ) : null}

      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
