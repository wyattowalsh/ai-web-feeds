import { Layers, Radio, Rss } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

type AggregatorBadgeProps = {
  variant?: "corpus" | "live" | "mixed";
  className?: string;
};

const VARIANT_CONFIG = {
  corpus: {
    label: "Corpus",
    icon: Layers,
    className: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  live: {
    label: "Live",
    icon: Radio,
    className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  mixed: {
    label: "Mixed",
    icon: Rss,
    className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
} as const;

export function AggregatorBadge({ variant = "corpus", className }: AggregatorBadgeProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em]",
        config.className,
        className,
      )}
    >
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}
