import { cn } from "@/lib/cn";

interface ContentCardSkeletonProps {
  count?: number;
  className?: string;
}

export function ContentCardSkeleton({
  count = 3,
  className,
}: ContentCardSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="surface-card space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="h-5 w-2/3 animate-pulse rounded-full bg-(--surface-muted)" />
              <div className="h-4 w-full animate-pulse rounded-full bg-(--surface-muted)" />
              <div className="h-4 w-5/6 animate-pulse rounded-full bg-(--surface-muted)" />
            </div>
            <div className="h-10 w-20 animate-pulse rounded-2xl bg-(--surface-muted)" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="h-7 w-20 animate-pulse rounded-full bg-(--surface-muted)" />
            <div className="h-7 w-24 animate-pulse rounded-full bg-(--surface-muted)" />
            <div className="h-7 w-16 animate-pulse rounded-full bg-(--surface-muted)" />
          </div>
          <div className="flex gap-3">
            <div className="h-9 w-28 animate-pulse rounded-full bg-(--surface-muted)" />
            <div className="h-9 w-24 animate-pulse rounded-full bg-(--surface-muted)" />
          </div>
        </div>
      ))}
    </div>
  );
}