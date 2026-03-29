import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "min-h-12 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3 text-sm text-[color:var(--ink)] shadow-sm outline-none transition duration-150 focus:border-[color:var(--brand)] focus:bg-[color:var(--surface)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}