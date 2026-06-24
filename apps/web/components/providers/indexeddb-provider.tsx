"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { openDB } from "@/lib/indexeddb/db";

type IndexedDbStatus = "loading" | "ready" | "error";

type IndexedDbContextValue = {
  status: IndexedDbStatus;
  error: string | null;
};

const IndexedDbContext = createContext<IndexedDbContextValue>({
  status: "loading",
  error: null,
});

export function IndexedDbProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<IndexedDbStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void openDB()
      .then(() => {
        if (!cancelled) {
          setStatus("ready");
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Failed to open IndexedDB");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ status, error }), [status, error]);

  return <IndexedDbContext.Provider value={value}>{children}</IndexedDbContext.Provider>;
}

export function useIndexedDb(): IndexedDbContextValue {
  return useContext(IndexedDbContext);
}
