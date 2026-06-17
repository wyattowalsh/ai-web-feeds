"use client";

import { useTheme as useNextThemes } from "next-themes";
import { useEffect, useRef } from "react";

import { themeManager, type ThemeMode } from "@/lib/theme-manager";

function toThemeMode(value: string | undefined): ThemeMode | null {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return null;
}

/**
 * Keeps FumaDocs/next-themes and the IndexedDB-backed theme manager aligned so
 * hub chrome and analytics charts share one effective light/dark state.
 */
export function HubThemeSync() {
  const { theme, setTheme: setNextTheme } = useNextThemes();
  const hydrated = useRef(false);
  const syncing = useRef(false);

  // Bootstrap: prefer persisted theme-manager preference on first client paint.
  useEffect(() => {
    if (hydrated.current) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const saved = themeManager.getTheme();
      const nextMode = toThemeMode(theme ?? undefined);

      syncing.current = true;
      try {
        if (saved !== "system" && saved !== nextMode) {
          setNextTheme(saved);
        } else if (nextMode && nextMode !== saved) {
          await themeManager.setTheme(nextMode);
        }
      } finally {
        syncing.current = false;
        if (!cancelled) {
          hydrated.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setNextTheme, theme]);

  // User toggles via FumaDocs ThemeToggle → persist for chart surfaces.
  useEffect(() => {
    if (!hydrated.current || syncing.current) {
      return;
    }

    const mode = toThemeMode(theme ?? undefined);
    if (!mode || mode === themeManager.getTheme()) {
      return;
    }

    syncing.current = true;
    void themeManager.setTheme(mode).finally(() => {
      syncing.current = false;
    });
  }, [theme]);

  return null;
}
