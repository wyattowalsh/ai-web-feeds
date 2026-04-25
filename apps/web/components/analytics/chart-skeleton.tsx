import { cn } from "@/lib/cn";

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("surface-card space-y-4", className)}>
      <div className="h-6 w-28 animate-pulse rounded-full bg-(--surface-muted)" />
      <div className="space-y-2">
        <div className="h-5 w-48 animate-pulse rounded-full bg-(--surface-muted)" />
        <div className="h-4 w-3/4 animate-pulse rounded-full bg-(--surface-muted)" />
      </div>
      <div className="h-80 animate-pulse rounded-4xl bg-(--surface-muted)" />
    </div>
  );
}
