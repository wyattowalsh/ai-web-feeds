import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { HubPageVariant } from "@/lib/hub/types";

type HubPageProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  variant?: HubPageVariant;
  className?: string;
};

export function HubPage({
  eyebrow,
  title,
  description,
  actions,
  children,
  variant = "default",
  className,
}: HubPageProps) {
  return (
    <div
      className={cn(
        "space-y-8",
        variant === "immersive" && "max-w-3xl mx-auto",
        variant === "compact" && "space-y-6",
        className,
      )}
    >
      <header className={cn("space-y-4", variant !== "compact" && "surface-panel")}>
        {eyebrow ? <div>{eyebrow}</div> : null}
        <div className="space-y-3">
          <h1 className={cn(variant === "compact" ? "text-title-medium" : "section-heading")}>
            {title}
          </h1>
          {description ? <p className="section-copy">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}
