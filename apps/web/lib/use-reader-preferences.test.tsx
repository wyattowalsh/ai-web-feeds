import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Preferences } from "@/lib/db";
import { DEFAULT_READER_PREFERENCES } from "@/lib/reader-types";

const LOCAL_STATE_KEY = "aiwebfeeds.reader.local-state";

const DEFAULT_PREFERENCES: Preferences = {
  id: "user_prefs",
  theme: "system",
  fontSize: 16,
  fontFamily: "system-ui",
  readingWidth: "medium",
  layout: "cards",
  showImages: true,
  showSummaries: true,
  markAsReadOnScroll: false,
  keyboardShortcuts: {
    j: "next_article",
    k: "previous_article",
    m: "mark_as_read",
    s: "star",
    a: "archive",
    v: "open_original",
    r: "refresh",
    "/": "search",
    "g h": "go_home",
    "g s": "go_starred",
    "g u": "go_unread",
    "g a": "go_all",
    escape: "close_modal",
    "?": "show_shortcuts",
    "[": "toggle_sidebar",
    "ctrl+k": "focus_search",
    "meta+k": "focus_search",
  },
  offlineMode: false,
  syncOnStartup: true,
  updatedAt: 100,
};

function createDbMocks(options: {
  dbPreferences?: Partial<Preferences>;
  getError?: boolean;
  updateError?: boolean;
}) {
  let currentPreferences: Preferences = {
    ...DEFAULT_PREFERENCES,
    ...options.dbPreferences,
  };

  return {
    preferences: {
      get: vi.fn(async () => {
        if (options.getError) {
          throw new Error("IndexedDB unavailable");
        }
        return currentPreferences;
      }),
      put: vi.fn(async (next: Preferences) => {
        currentPreferences = next;
      }),
      update: vi.fn(async (updates: Partial<Preferences>) => {
        if (options.updateError) {
          throw new Error("write failed");
        }

        currentPreferences = {
          ...currentPreferences,
          ...updates,
          updatedAt:
            typeof updates.updatedAt === "number"
              ? updates.updatedAt
              : currentPreferences.updatedAt + 1,
        };
      }),
    },
    getCurrentPreferences: () => currentPreferences,
  };
}

async function loadPreferencesModule(
  options: {
    dbPreferences?: Partial<Preferences>;
    snapshotRaw?: string;
    getError?: boolean;
    updateError?: boolean;
  } = {},
) {
  vi.resetModules();
  window.localStorage.clear();

  if (options.snapshotRaw !== undefined) {
    window.localStorage.setItem(LOCAL_STATE_KEY, options.snapshotRaw);
  }

  const dbMocks = createDbMocks(options);

  vi.doMock("@/lib/db", () => ({
    preferences: dbMocks.preferences,
    articles: {
      get: vi.fn(async () => undefined),
      put: vi.fn(async () => undefined),
    },
    annotations: {
      get: vi.fn(async () => undefined),
      put: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
      getByArticle: vi.fn(async () => []),
    },
    syncQueue: {
      put: vi.fn(async () => undefined),
      getPending: vi.fn(async () => []),
    },
  }));

  const module = await import("@/lib/use-reader-preferences");
  return { module, ...dbMocks };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("useReaderPreferences", () => {
  it("restores a newer local-state backup over stale IndexedDB preferences", async () => {
    const backupUpdatedAt = 500;
    const { module, preferences } = await loadPreferencesModule({
      dbPreferences: {
        theme: "light",
        fontSize: 14,
        updatedAt: 100,
      },
      snapshotRaw: JSON.stringify({
        version: 2,
        updatedAt: backupUpdatedAt,
        preferences: {
          ...DEFAULT_READER_PREFERENCES,
          theme: "dark",
          fontSize: 22,
          updatedAt: backupUpdatedAt,
        },
        articles: {},
      }),
    });

    function Probe() {
      const { loading, preferences: readerPreferences } = module.useReaderPreferences();
      return (
        <div>
          <div data-testid="loading">{String(loading)}</div>
          <div data-testid="theme">{readerPreferences.theme}</div>
          <div data-testid="font-size">{readerPreferences.fontSize}</div>
        </div>
      );
    }

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("theme")).toHaveTextContent("dark");
      expect(screen.getByTestId("font-size")).toHaveTextContent("22");
    });

    expect(preferences.put).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: "dark",
        fontSize: 22,
        updatedAt: backupUpdatedAt,
      }),
    );
  });

  it("falls back to defaults when IndexedDB fails and backup storage is corrupted", async () => {
    const { module } = await loadPreferencesModule({
      getError: true,
      snapshotRaw: "{broken-json",
    });

    function Probe() {
      const { loading, preferences: readerPreferences } = module.useReaderPreferences();
      return (
        <div>
          <div data-testid="loading">{String(loading)}</div>
          <div data-testid="theme">{readerPreferences.theme}</div>
          <div data-testid="show-images">{String(readerPreferences.showImages)}</div>
        </div>
      );
    }

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("theme")).toHaveTextContent(DEFAULT_READER_PREFERENCES.theme);
      expect(screen.getByTestId("show-images")).toHaveTextContent("true");
    });
  });

  it("persists optimistic updates to the versioned backup when IndexedDB writes fail", async () => {
    const { module } = await loadPreferencesModule({
      updateError: true,
    });

    function Probe() {
      const { preferences: readerPreferences, update } = module.useReaderPreferences();
      return (
        <div>
          <div data-testid="theme">{readerPreferences.theme}</div>
          <div data-testid="show-images">{String(readerPreferences.showImages)}</div>
          <button onClick={() => void update({ theme: "dark", showImages: false })}>update</button>
        </div>
      );
    }

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("theme")).toHaveTextContent("system");
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "update" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("theme")).toHaveTextContent("dark");
      expect(screen.getByTestId("show-images")).toHaveTextContent("false");
    });

    const stored = JSON.parse(window.localStorage.getItem(LOCAL_STATE_KEY) ?? "{}") as {
      preferences?: { theme?: string; showImages?: boolean };
    };
    expect(stored.preferences).toEqual(
      expect.objectContaining({
        theme: "dark",
        showImages: false,
      }),
    );
  });
});
