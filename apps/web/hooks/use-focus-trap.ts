"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void,
) {
  useEffect(() => {
    if (!active) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => !node.hasAttribute("disabled") && node.tabIndex !== -1,
      );

    const initial = focusables();
    initial[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape?.();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const nodes = focusables();
      if (nodes.length === 0) {
        return;
      }

      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const activeEl = document.activeElement;

      if (event.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (activeEl === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, containerRef, onEscape]);
}
