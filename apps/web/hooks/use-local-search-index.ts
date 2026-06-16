"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  buildLocalSearchIndex,
  type LocalSearchOptions,
  type LocalSearchResult,
} from "@/lib/reader/local-search";

export function useLocalSearchIndex() {
  const indexRef = useRef<Awaited<ReturnType<typeof buildLocalSearchIndex>> | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void buildLocalSearchIndex().then((index) => {
      if (!cancelled) {
        indexRef.current = index;
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const search = useCallback(
    (query: string, options: LocalSearchOptions = {}): LocalSearchResult[] => {
      return indexRef.current?.search(query, options) ?? [];
    },
    [],
  );

  return { ready, search };
}
