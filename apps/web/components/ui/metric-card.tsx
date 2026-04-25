import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  className?: string;
  surface?: "default" | "soft";
  valueClassName?: string;
  iconClassName?: string;
}

export function MetricCard({
  label,
  value,
  detail,
  icon,
  className,
  surface = "default",
  valueClassName,
  iconClassName,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        surface === "soft" ? "surface-card-soft" : "surface-card",
        "flex items-start justify-between gap-4",
        className,
      )}
    >
      <div className="space-y-3">
        <p className="metric-label">{label}</p>
        <div className={cn("metric-value", valueClassName)}>{value}</div>
        {detail ? <div className="small-note">{detail}</div> : null}
      </div>
      {icon ? (
        <span
          className={cn(
            "flex size-12 flex-shrink-0 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)",
            iconClassName,
          )}
        >
          {icon}
        </span>
      ) : null}
    </div>
  );
}
