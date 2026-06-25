"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  normalizeSavedReaderFilterPayload,
  type SavedReaderFilterPayload,
} from "@/lib/server/contracts/reader-filter";
import { normalizeTopicsValue } from "@/lib/reader";
import type { FeedsWorkspaceInitialState } from "@/lib/reader-route-types";
import { getStoredUserId } from "@/lib/user-identity";

export type SavedReaderFilter = {
  id: string;
  user_id: string;
  filter_name: string;
  payload: SavedReaderFilterPayload;
  schema_version: string;
  use_count: number;
  pinned: boolean;
  is_default: boolean;
  created_at: string;
  last_used_at: string;
};

type ListFiltersResponse = {
  filters?: SavedReaderFilter[];
  error?: string;
};

type SaveFilterResponse = {
  success?: boolean;
  filter?: SavedReaderFilter;
  error?: string;
};

export function readerStateToFilterPayload(
  state: FeedsWorkspaceInitialState,
): SavedReaderFilterPayload {
  return normalizeSavedReaderFilterPayload({
    query: state.query,
    feedIds: state.feedIds,
    sourceType: state.sourceType,
    topics: state.topics,
    verified: state.verified,
    sort: state.sort,
    readerView: state.readerView,
  });
}

export function filterPayloadToUrlOverrides(
  payload: SavedReaderFilterPayload,
): Record<string, string | string[] | null | undefined> {
  const normalized = normalizeSavedReaderFilterPayload(payload);

  return {
    q: normalized.query || null,
    source_type: normalized.sourceType || null,
    topics: normalized.topics.length > 0 ? normalizeTopicsValue(normalized.topics) : null,
    verified:
      normalized.verified === true ? "true" : normalized.verified === false ? "false" : null,
    reader_view: normalized.readerView === "latest" ? null : normalized.readerView,
    sort: normalized.sort === "latest" ? null : normalized.sort,
    feed: normalized.feedIds.length > 0 ? normalized.feedIds : null,
    cursor: null,
  };
}

export function hasSavableReaderFilters(state: FeedsWorkspaceInitialState): boolean {
  return (
    Boolean(state.query) ||
    state.feedIds.length > 0 ||
    Boolean(state.sourceType) ||
    state.topics.length > 0 ||
    state.verified !== null ||
    state.sort !== "latest" ||
    state.readerView !== "latest"
  );
}

export interface UseSavedReaderFiltersParams {
  currentState: FeedsWorkspaceInitialState;
  onApplyPayload: (payload: SavedReaderFilterPayload) => void;
}

export interface UseSavedReaderFiltersResult {
  userId: string | null;
  filters: SavedReaderFilter[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  canSave: boolean;
  saveFilter: (filterName: string) => Promise<boolean>;
  deleteFilter: (filterId: string) => Promise<boolean>;
  loadFilter: (filter: SavedReaderFilter) => void;
  refresh: () => Promise<void>;
}

export function useSavedReaderFilters({
  currentState,
  onApplyPayload,
}: UseSavedReaderFiltersParams): UseSavedReaderFiltersResult {
  const [userId, setUserId] = useState<string | null>(null);
  const [filters, setFilters] = useState<SavedReaderFilter[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUserId(getStoredUserId());
  }, []);

  const canSave = useMemo(() => hasSavableReaderFilters(currentState), [currentState]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setFilters([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/user/filters?user_id=${encodeURIComponent(userId)}`);
      const data = (await response.json()) as ListFiltersResponse;

      if (!response.ok) {
        setError(data.error ?? "Failed to load saved filter presets.");
        setFilters([]);
        return;
      }

      setFilters(Array.isArray(data.filters) ? data.filters : []);
    } catch (loadError) {
      console.error("Failed to load saved reader filters:", loadError);
      setError("Failed to load saved filter presets.");
      setFilters([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveFilter = useCallback(
    async (filterName: string) => {
      const trimmedName = filterName.trim();
      if (!userId || !trimmedName) {
        return false;
      }

      setSaving(true);
      setError(null);

      try {
        const response = await fetch("/api/user/filters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            filter_name: trimmedName,
            payload: readerStateToFilterPayload(currentState),
          }),
        });
        const data = (await response.json()) as SaveFilterResponse;

        if (!response.ok) {
          setError(data.error ?? "Failed to save filter preset.");
          return false;
        }

        if (data.filter) {
          setFilters((current) => {
            const withoutDuplicate = current.filter((entry) => entry.id !== data.filter!.id);
            return [data.filter!, ...withoutDuplicate].sort((left, right) =>
              left.filter_name.localeCompare(right.filter_name),
            );
          });
        } else {
          await refresh();
        }

        return true;
      } catch (saveError) {
        console.error("Failed to save reader filter preset:", saveError);
        setError("Failed to save filter preset.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [currentState, refresh, userId],
  );

  const deleteFilter = useCallback(
    async (filterId: string) => {
      if (!userId) {
        return false;
      }

      setError(null);

      try {
        const response = await fetch(
          `/api/user/filters?user_id=${encodeURIComponent(userId)}&id=${encodeURIComponent(
            filterId,
          )}`,
          { method: "DELETE" },
        );
        const data = (await response.json()) as { success?: boolean; error?: string };

        if (!response.ok) {
          setError(data.error ?? "Failed to delete filter preset.");
          return false;
        }

        setFilters((current) => current.filter((entry) => entry.id !== filterId));
        return true;
      } catch (deleteError) {
        console.error("Failed to delete reader filter preset:", deleteError);
        setError("Failed to delete filter preset.");
        return false;
      }
    },
    [userId],
  );

  const loadFilter = useCallback(
    (filter: SavedReaderFilter) => {
      const payload = normalizeSavedReaderFilterPayload(filter.payload);
      onApplyPayload(payload);
    },
    [onApplyPayload],
  );

  return {
    userId,
    filters,
    loading,
    saving,
    error,
    canSave,
    saveFilter,
    deleteFilter,
    loadFilter,
    refresh,
  };
}
