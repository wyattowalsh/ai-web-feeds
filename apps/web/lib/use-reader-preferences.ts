"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PREFERENCES, preferences as preferencesStore, type Preferences } from "@/lib/db";

type ReaderPreferences = Omit<
  Preferences,
  "id" | "updatedAt" | "keyboardShortcuts" | "offlineMode" | "syncOnStartup"
>;

const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  theme: DEFAULT_PREFERENCES.theme,
  fontSize: DEFAULT_PREFERENCES.fontSize,
  fontFamily: DEFAULT_PREFERENCES.fontFamily,
  readingWidth: DEFAULT_PREFERENCES.readingWidth,
  layout: DEFAULT_PREFERENCES.layout,
  showImages: DEFAULT_PREFERENCES.showImages,
  showSummaries: DEFAULT_PREFERENCES.showSummaries,
  markAsReadOnScroll: DEFAULT_PREFERENCES.markAsReadOnScroll,
};

function toReaderPreferences(value?: Preferences | null): ReaderPreferences {
  if (!value) {
    return DEFAULT_READER_PREFERENCES;
  }

  return {
    theme: value.theme,
    fontSize: value.fontSize,
    fontFamily: value.fontFamily,
    readingWidth: value.readingWidth,
    layout: value.layout,
    showImages: value.showImages,
    showSummaries: value.showSummaries,
    markAsReadOnScroll: value.markAsReadOnScroll,
  };
}

export function useReaderPreferences() {
  const [preferences, setPreferences] = useState<ReaderPreferences>(DEFAULT_READER_PREFERENCES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void preferencesStore
      .get()
      .then((storedPreferences) => {
        if (!cancelled) {
          setPreferences(toReaderPreferences(storedPreferences));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreferences(DEFAULT_READER_PREFERENCES);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (nextPreferences: Partial<ReaderPreferences>) => {
    setPreferences((current) => {
      const mergedPreferences = {
        ...current,
        ...nextPreferences,
      };

      void preferencesStore.put({
        ...DEFAULT_PREFERENCES,
        ...mergedPreferences,
        id: "user_prefs",
        updatedAt: Date.now(),
      });

      return mergedPreferences;
    });
  }, []);

  return {
    preferences,
    loading,
    update,
  };
}
