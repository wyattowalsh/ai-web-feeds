import type { ReactNode } from "react";

export function FilterFieldLabel({ children }: { children: ReactNode }) {
  return <span className="small-note font-medium text-(--ink-muted)">{children}</span>;
}
