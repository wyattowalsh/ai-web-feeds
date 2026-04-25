import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ChartShellProps {
  title: string;
  description: string;
  eyebrow?: string;
  className?: string;
  bodyClassName?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function ChartShell({
  title,
  description,
  eyebrow,
  className,
  bodyClassName,
  footer,
  children,
}: ChartShellProps) {
  return (
    <section className={cn("surface-card", className)}>
      <div className="mb-6 space-y-4">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <div className="space-y-2">
          <h2 className="text-title-medium">{title}</h2>
          <p className="small-note max-w-2xl">{description}</p>
        </div>
      </div>

      <div className={cn("space-y-5", bodyClassName)}>{children}</div>

      {footer ? <div className="mt-6 border-t border-(--line) pt-5">{footer}</div> : null}
    </section>
  );
}
