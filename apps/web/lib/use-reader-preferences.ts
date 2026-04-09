"use client";

/**
 * Reader Data Platform — useReaderPreferences hook
 *
 * Reads and updates reader display preferences from IndexedDB.
 * Mutations are persisted immediately and reflected in the returned state.
 *
 * Usage:
 * ```tsx
 * const { preferences, loading, update } = useReaderPreferences();
 * ```
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { preferences as prefsDB } from "@/lib/db";
import type { Preferences } from "@/lib/db";
import { writeReaderPreferencesBackup, getReaderPreferencesBackup } from "@/lib/reader-local-state";
import {
  DEFAULT_READER_PREFERENCES,
  normalizeReaderPreferencesSubset,
  type ReaderPreferencesSubset,
} from "@/lib/reader-types";

export interface UseReaderPreferencesResult {
  preferences: ReaderPreferencesSubset;
  loading: boolean;
  update: (updates: Partial<ReaderPreferencesSubset>) => Promise<void>;
}

function extractSubset(prefs: Preferences): ReaderPreferencesSubset {
  return normalizeReaderPreferencesSubset({
    layout: prefs.layout,
    theme: prefs.theme,
    fontSize: prefs.fontSize,
    fontFamily: prefs.fontFamily,
    readingWidth: prefs.readingWidth,
    showImages: prefs.showImages,
    showSummaries: prefs.showSummaries,
    markAsReadOnScroll: prefs.markAsReadOnScroll,
  });
}

export function useReaderPreferences(): UseReaderPreferencesResult {
  const [preferences, setPreferences] = useState<ReaderPreferencesSubset>({
    ...DEFAULT_READER_PREFERENCES,
  });
  const [loading, setLoading] = useState(true);
  const preferencesRef = useRef(preferences);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    let cancelled = false;

    const loadPreferences = async () => {
      const backup = getReaderPreferencesBackup();

      try {
        const persisted = await prefsDB.get();
        const restored =
          backup && backup.updatedAt > persisted.updatedAt
            ? ({
                ...persisted,
                ...backup,
                updatedAt: backup.updatedAt,
              } satisfies Preferences)
            : persisted;

        if (backup && backup.updatedAt > persisted.updatedAt) {
          await prefsDB.put(restored);
        }

        writeReaderPreferencesBackup(extractSubset(restored), restored.updatedAt);
        if (!cancelled) {
          setPreferences(extractSubset(restored));
        }
      } catch {
        const restored = backup
          ? normalizeReaderPreferencesSubset(backup)
          : { ...DEFAULT_READER_PREFERENCES };
        writeReaderPreferencesBackup(restored, backup?.updatedAt ?? Date.now());
        if (!cancelled) {
          setPreferences(restored);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPreferences();

    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (updates: Partial<ReaderPreferencesSubset>) => {
    const nextPreferences = normalizeReaderPreferencesSubset({
      ...preferencesRef.current,
      ...updates,
    });
    const updatedAt = Date.now();

    preferencesRef.current = nextPreferences;
    setPreferences(nextPreferences);
    writeReaderPreferencesBackup(nextPreferences, updatedAt);

    try {
      await prefsDB.update({ ...updates, updatedAt } as Partial<Preferences>);
    } catch {
      // The versioned local-state backup already captured the write.
    }
  }, []);

  return { preferences, loading, update };
}
