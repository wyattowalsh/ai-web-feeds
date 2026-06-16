import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  hydrateArticleStates,
  loadArticleStatesFromIDB,
  saveArticleStatesToIDB,
  scanLocalStorageArticleStates,
  syncArticleState,
} from "./hydrate-article-state";
import { DEFAULT_ARTICLE_STATE } from "./constants";
import { articleStateStorageKey, writeArticleState } from "./article-state";
import { articles, preferences, closeDB, type Preferences } from "@/lib/db";
import type { ReaderArticleState } from "./types";

type PreferencesWithArticleStates = Preferences & {
  articleStates?: Record<string, ReaderArticleState>;
};

function clearLocalStorage() {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.clear();
  }
}

async function clearPreferencesAndArticles() {
  try {
    // Overwrite preferences with defaults (minus articleStates) to reset
    await preferences.put({
      id: "user_prefs",
      theme: "system",
      fontSize: 16,
      fontFamily: "system-ui",
      readingWidth: "medium",
      layout: "cards",
      showImages: true,
      showSummaries: true,
      markAsReadOnScroll: false,
      keyboardShortcuts: {},
      offlineMode: false,
      syncOnStartup: true,
      updatedAt: Date.now(),
    });
  } catch {
    // ignore
  }
  try {
    // Best effort clear known articles used in tests
    const ids = ["a1", "a2", "a-sync"];
    for (const id of ids) {
      try {
        await articles.delete(id);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

describe("hydrate-article-state", () => {
  beforeEach(async () => {
    clearLocalStorage();
    await clearPreferencesAndArticles();
    vi.useRealTimers();
  });

  afterEach(async () => {
    clearLocalStorage();
    await clearPreferencesAndArticles();
    try {
      closeDB();
    } catch {
      // ignore
    }
  });

  it("scanLocalStorageArticleStates returns empty when no states or no storage", () => {
    const result = scanLocalStorageArticleStates();
    expect(result).toEqual({});
  });

  it("scanLocalStorageArticleStates discovers non-default states under prefix", () => {
    const state1: ReaderArticleState = {
      read: true,
      starred: false,
      archived: false,
      bookmarked: true,
    };
    const state2: ReaderArticleState = {
      read: false,
      starred: true,
      archived: true,
      bookmarked: false,
    };

    writeArticleState("art-1", state1);
    writeArticleState("art-2", state2);
    // default should be skipped
    writeArticleState("art-3", { ...DEFAULT_ARTICLE_STATE });

    const scanned = scanLocalStorageArticleStates();
    expect(scanned).toEqual({
      "art-1": state1,
      "art-2": state2,
    });
    expect(scanned["art-3"]).toBeUndefined();
  });

  it("load/save roundtrip article states via IDB preferences", async () => {
    const states: Record<string, ReaderArticleState> = {
      s1: { read: true, starred: true, archived: false, bookmarked: false },
      s2: { read: false, starred: false, archived: true, bookmarked: true },
    };

    await saveArticleStatesToIDB(states);

    const loaded = await loadArticleStatesFromIDB();
    expect(loaded["s1"]).toEqual(states["s1"]);
    expect(loaded["s2"]).toEqual(states["s2"]);
  });

  it("saveArticleStatesToIDB merges without clobbering other prefs", async () => {
    // Seed some base prefs
    await preferences.put({
      id: "user_prefs",
      theme: "dark",
      fontSize: 18,
      fontFamily: "sans",
      readingWidth: "wide",
      layout: "list",
      showImages: false,
      showSummaries: true,
      markAsReadOnScroll: true,
      keyboardShortcuts: { j: "next_article" },
      offlineMode: true,
      syncOnStartup: false,
      updatedAt: 123,
    });

    await saveArticleStatesToIDB({
      x1: { read: true, starred: false, archived: false, bookmarked: false },
    });

    const prefs = await preferences.get();
    expect(prefs.theme).toBe("dark");
    expect((prefs as PreferencesWithArticleStates).articleStates?.x1?.read).toBe(true);
  });

  it("hydrateArticleStates migrates from localStorage to IDB and clears", async () => {
    const st: ReaderArticleState = {
      read: true,
      starred: false,
      archived: false,
      bookmarked: true,
    };
    writeArticleState("mig-1", st);
    writeArticleState("mig-2", { ...DEFAULT_ARTICLE_STATE, starred: true });

    const summary = await hydrateArticleStates({ clearLocalStorage: true });

    expect(summary.migratedCount).toBe(2);
    expect(summary.clearedCount).toBe(2);
    expect(summary.totalInIDB).toBeGreaterThanOrEqual(2);

    // local keys gone
    expect(window.localStorage.getItem(articleStateStorageKey("mig-1"))).toBeNull();
    expect(window.localStorage.getItem(articleStateStorageKey("mig-2"))).toBeNull();

    const idb = await loadArticleStatesFromIDB();
    expect(idb["mig-1"]).toEqual(st);
    expect(idb["mig-2"].starred).toBe(true);
  });

  it("hydrateArticleStates respects clearLocalStorage=false", async () => {
    writeArticleState("keep-1", { ...DEFAULT_ARTICLE_STATE, read: true });

    const summary = await hydrateArticleStates({ clearLocalStorage: false });
    expect(summary.migratedCount).toBe(1);
    expect(summary.clearedCount).toBe(0);
    expect(window.localStorage.getItem(articleStateStorageKey("keep-1"))).not.toBeNull();
  });

  it("syncArticleState merges into IDB map and optionally patches article store", async () => {
    // Seed an article record
    const art = {
      id: "a-sync",
      feedId: "f1",
      title: "Sync Me",
      link: "https://ex",
      content: "body",
      pubDate: Date.now(),
      topics: [],
      rawCategories: [],
      sourceTopics: [],
      enclosures: [],
      read: false,
      starred: false,
      archived: false,
      tags: [],
      cachedAt: Date.now(),
      lastModified: Date.now(),
    };
    await articles.put(art);

    await syncArticleState("a-sync", { read: true, starred: true });

    const idbStates = await loadArticleStatesFromIDB();
    expect(idbStates["a-sync"].read).toBe(true);
    expect(idbStates["a-sync"].starred).toBe(true);

    const updatedArt = await articles.get("a-sync");
    expect(updatedArt?.read).toBe(true);
    expect(updatedArt?.starred).toBe(true);

    // bookmarked should NOT patch article (only in overlay map)
    await syncArticleState("a-sync", { bookmarked: true });
    const afterBm = await articles.get("a-sync");
    expect(afterBm && "bookmarked" in afterBm).toBe(false); // bookmarked is overlay only, not patched to articles store
    expect((await loadArticleStatesFromIDB())["a-sync"].bookmarked).toBe(true);
  });

  it("syncArticleState creates state from defaults when none prior", async () => {
    await syncArticleState("new-one", { archived: true });
    const loaded = await loadArticleStatesFromIDB();
    expect(loaded["new-one"]).toEqual({ ...DEFAULT_ARTICLE_STATE, archived: true });
  });
});
