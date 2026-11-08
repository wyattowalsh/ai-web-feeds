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
  empty?: boolean;
  error?: string | null;
}

export function ChartShell({
  title,
  description,
  eyebrow,
  className,
  bodyClassName,
  footer,
  children,
  empty = false,
  error = null,
}: ChartShellProps) {
  const errorMessage = typeof error === "string" ? error.trim() : "";
  let state: "ready" | "empty" | "error" = "ready";
  if (errorMessage) {
    state = "error";
  } else if (empty) {
    state = "empty";
  }

  let body = children;
  if (state === "error") {
    body = (
      <div
        role="alert"
        data-state="error"
        className="rounded-2xl border border-(--danger-tone)/40 bg-(--surface) p-5 text-(--ink)"
      >
        <p className="text-lg font-semibold">Chart error</p>
        <p className="small-note mt-2">{errorMessage}</p>
      </div>
    );
  } else if (state === "empty") {
    body = (
      <div
        role="status"
        data-state="empty"
        className="rounded-2xl border border-(--warning-tone)/40 bg-(--surface) p-5 text-(--ink)"
      >
        <p className="text-lg font-semibold">No data</p>
        <p className="small-note mt-2">This chart is empty.</p>
      </div>
    );
  }

  return (
    <section
      aria-label={title}
      className={cn("surface-card", className)}
      data-state={state}
      data-demo="false"
    >
      <div className="mb-6 space-y-4">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <div className="space-y-2">
          <h2 className="text-title-medium">{title}</h2>
          <p className="small-note max-w-2xl">{description}</p>
        </div>
      </div>

      <div className={cn("space-y-5", bodyClassName)}>{body}</div>

      {footer ? <div className="mt-6 border-t border-(--line) pt-5">{footer}</div> : null}
    </section>
  );
}
