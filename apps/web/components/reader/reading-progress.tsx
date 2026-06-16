"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type ReadingProgressProps = {
  className?: string;
  /** Optional container selector to scope progress calculation. Defaults to document scroll. */
  containerSelector?: string;
};

export function ReadingProgress({ className, containerSelector }: ReadingProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;

    const compute = () => {
      if (typeof window === "undefined") {
        return;
      }

      const container = containerSelector
        ? (document.querySelector(containerSelector) as HTMLElement | null)
        : null;

      const scrollTop = container
        ? container.scrollTop
        : window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = container
        ? container.scrollHeight - container.clientHeight
        : Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) -
          window.innerHeight;

      if (!scrollHeight || scrollHeight <= 0) {
        setProgress(0);
        return;
      }

      const next = Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
      setProgress(next);
    };

    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };

    // initial
    compute();

    const target: HTMLElement | Window = containerSelector
      ? (document.querySelector(containerSelector) as HTMLElement) || window
      : window;

    target.addEventListener("scroll", onScroll as EventListener, { passive: true });
    window.addEventListener("resize", onScroll as EventListener);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      target.removeEventListener("scroll", onScroll as EventListener);
      window.removeEventListener("resize", onScroll as EventListener);
    };
  }, [containerSelector]);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent",
        className,
      )}
      aria-hidden="true"
    >
      <div
        className="h-full bg-(--brand) transition-[width] duration-75 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export default ReadingProgress;
