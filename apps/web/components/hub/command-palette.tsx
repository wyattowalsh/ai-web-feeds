"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { PRIMARY_HUB_NAV } from "@/lib/hub/links";
import type { HubNavItem } from "@/lib/hub/types";

export type CommandPaletteProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

type PaletteItem = {
  id: string;
  label: string;
  href: string;
  description?: string;
  external?: boolean;
};

function buildItems(): PaletteItem[] {
  // Derive directly from PRIMARY_HUB_NAV (single source of truth in lib/hub/links.ts)
  return PRIMARY_HUB_NAV.map((item: HubNavItem, index: number) => ({
    id: `nav-${index}`,
    label: item.label,
    href: item.href,
    description: item.description,
    external: item.external ?? false,
  }));
}

export function CommandPalette({
  open: controlledOpen,
  onOpenChange,
  className,
}: CommandPaletteProps) {
  const router = useRouter();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setInternalOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const items = React.useMemo(() => buildItems(), []);
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.description?.toLowerCase().includes(q) ?? false) ||
        item.href.toLowerCase().includes(q),
    );
  }, [items, query]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Focus trap: keep Tab within the panel and restore focus on close.
  React.useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusInput = () => {
      const input = document.getElementById("hub-command-input") as HTMLInputElement | null;
      input?.focus();
      input?.select();
    };
    const focusTimer = window.setTimeout(focusInput, 0);

    const panel = panelRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const onTabKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panel) {
        return;
      }

      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (node) => !node.hasAttribute("disabled") && node.tabIndex !== -1,
      );
      if (nodes.length === 0) {
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onTabKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onTabKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  // Global Cmd+K / Ctrl+K handler
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac =
        typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const next = !open;
        setOpen(next);
        if (next) {
          // Focus input on next tick after mount
          window.setTimeout(() => {
            const input = document.getElementById("hub-command-input") as HTMLInputElement | null;
            input?.focus();
            input?.select();
          }, 0);
        }
      }

      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        setQuery("");
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, setOpen]);

  const go = (href: string, external?: boolean) => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);

    if (external) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(href);
  };

  const onItemClick = (item: PaletteItem) => {
    go(item.href, item.external);
  };

  const onKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const target = filtered[activeIndex];
      if (target) {
        e.preventDefault();
        go(target.href, target.external);
      }
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]",
        className,
      )}
      onClick={() => setOpen(false)}
    >
      <div
        ref={panelRef}
        className="surface-card w-full max-w-[640px] overflow-hidden border-(--line) bg-(--surface) p-0 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-(--line) px-3 py-2">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input
            id="hub-command-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDownInput}
            placeholder="Type a command or search routes..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </div>

        <div className="max-h-[420px] overflow-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No matching routes.
            </div>
          ) : (
            <ul role="listbox" aria-label="Hub routes">
              {filtered.map((item, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <li key={item.id} role="option" aria-selected={isActive}>
                    <button
                      type="button"
                      onClick={() => onItemClick(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition",
                        isActive
                          ? "bg-muted text-foreground"
                          : "hover:bg-muted/60 text-foreground/90",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="font-medium">{item.label}</div>
                        {item.description ? (
                          <div className="truncate text-xs text-muted-foreground">
                            {item.description}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-[10px] uppercase tracking-[0.08em] text-muted-foreground/70">
                        {item.external ? "Open" : item.href}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-(--line) px-3 py-2 text-[11px] text-muted-foreground">
          <div>
            Navigate with <span className="font-medium">↑</span>{" "}
            <span className="font-medium">↓</span>, select with{" "}
            <span className="font-medium">Enter</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded px-1.5 py-0.5 hover:bg-muted"
          >
            Esc to close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Optional trigger button that toggles the palette.
 * Consumers can also control open state directly via props.
 */
export function CommandPaletteTrigger({
  className,
  label = "Command",
  onOpen,
}: {
  className?: string;
  label?: string;
  onOpen?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.()}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
      aria-label="Open command palette (⌘K)"
    >
      <Search className="size-4" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
      <kbd className="ml-1 hidden rounded border bg-muted px-1 text-[10px] text-muted-foreground sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}

export default CommandPalette;
