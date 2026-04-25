import { describe, expect, it } from "vitest";

import {
  createDatabase,
  DEFAULT_PREFERENCES,
  STORES,
  normalizePreferences,
  preferencesNeedMigration,
} from "./schema";

class MockNameList {
  private readonly names = new Set<string>();

  constructor(initial: string[] = []) {
    initial.forEach((name) => this.names.add(name));
  }

  add(name: string): void {
    this.names.add(name);
  }

  contains(name: string): boolean {
    return this.names.has(name);
  }

  item(index: number): string | null {
    return Array.from(this.names)[index] ?? null;
  }

  get length(): number {
    return this.names.size;
  }
}

function createRequest<T>(result: T): IDBRequest<T> {
  const request = {
    result,
    onsuccess: null,
    onerror: null,
  } as unknown as IDBRequest<T>;

  queueMicrotask(() => {
    request.onsuccess?.({ target: request } as Event);
  });

  return request;
}

class MockObjectStore {
  private readonly indexList: MockNameList;
  private readonly definitions = new Map<
    string,
    { keyPath: IDBKeyPath; options?: IDBIndexParameters }
  >();

  readonly indexNames: DOMStringList;
  readonly records = new Map<string, unknown>();

  constructor(
    private readonly keyPath: string,
    existingIndexes: string[] = [],
  ) {
    this.indexList = new MockNameList(existingIndexes);
    this.indexNames = this.indexList as unknown as DOMStringList;
    existingIndexes.forEach((name) => {
      this.definitions.set(name, { keyPath: name });
    });
  }

  hasIndex(name: string): boolean {
    return this.indexList.contains(name);
  }

  getIndexDefinition(
    name: string,
  ): { keyPath: IDBKeyPath; options?: IDBIndexParameters } | undefined {
    return this.definitions.get(name);
  }

  createIndex(name: string, keyPath: IDBKeyPath, options?: IDBIndexParameters): IDBIndex {
    this.indexList.add(name);
    this.definitions.set(name, { keyPath, options });
    return {} as IDBIndex;
  }

  get(key: string): IDBRequest<unknown> {
    return createRequest(this.records.get(key));
  }

  put(value: Record<string, unknown>): IDBRequest<Record<string, unknown>> {
    this.records.set(String(value[this.keyPath]), value);
    return createRequest(value);
  }
}

class MockDatabase {
  private readonly storeList = new MockNameList();

  readonly objectStoreNames: DOMStringList;
  readonly stores = new Map<string, MockObjectStore>();

  constructor() {
    this.objectStoreNames = this.storeList as unknown as DOMStringList;
  }

  addExistingStore(
    name: string,
    keyPath: string,
    indexes: string[] = [],
    records: Array<Record<string, unknown>> = [],
  ): MockObjectStore {
    const store = new MockObjectStore(keyPath, indexes);
    records.forEach((record) => {
      store.records.set(String(record[keyPath]), record);
    });
    this.stores.set(name, store);
    this.storeList.add(name);
    return store;
  }

  createObjectStore(name: string, options: IDBObjectStoreParameters): IDBObjectStore {
    return this.addExistingStore(
      name,
      String(options.keyPath ?? "id"),
    ) as unknown as IDBObjectStore;
  }
}

class MockTransaction {
  constructor(private readonly db: MockDatabase) {}

  objectStore(name: string): IDBObjectStore {
    const store = this.db.stores.get(name);
    if (!store) {
      throw new Error(`Missing object store: ${name}`);
    }
    return store as unknown as IDBObjectStore;
  }
}

async function flushIndexedDbMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("db schema migrations", () => {
  it("adds missing indexes to existing stores during upgrades", () => {
    const db = new MockDatabase();
    const articles = db.addExistingStore(STORES.ARTICLES, "id", ["feedId"]);
    const transaction = new MockTransaction(db);

    createDatabase(db as unknown as IDBDatabase, transaction as unknown as IDBTransaction);

    expect(articles.hasIndex("feedId")).toBe(true);
    expect(articles.hasIndex("pubDate")).toBe(true);
    expect(articles.hasIndex("read")).toBe(true);
    expect(articles.hasIndex("starred")).toBe(true);
    expect(articles.hasIndex("tags")).toBe(true);
    expect(articles.hasIndex("cachedAt")).toBe(true);
    expect(articles.getIndexDefinition("tags")).toEqual({
      keyPath: "tags",
      options: { unique: false, multiEntry: true },
    });
    expect(articles.getIndexDefinition("pubDate")).toEqual({
      keyPath: "pubDate",
      options: { unique: false },
    });
  });

  it("seeds default preferences for fresh databases", async () => {
    const db = new MockDatabase();
    const transaction = new MockTransaction(db);

    createDatabase(db as unknown as IDBDatabase, transaction as unknown as IDBTransaction);
    await flushIndexedDbMicrotasks();

    expect(db.stores.get(STORES.PREFERENCES)?.records.get(DEFAULT_PREFERENCES.id)).toEqual(
      DEFAULT_PREFERENCES,
    );
  });

  it("normalizes legacy preference records during migration", async () => {
    const db = new MockDatabase();
    db.addExistingStore(
      STORES.PREFERENCES,
      "id",
      [],
      [{ id: DEFAULT_PREFERENCES.id, theme: "dark" }],
    );
    const transaction = new MockTransaction(db);

    createDatabase(db as unknown as IDBDatabase, transaction as unknown as IDBTransaction);
    await flushIndexedDbMicrotasks();

    expect(db.stores.get(STORES.PREFERENCES)?.records.get(DEFAULT_PREFERENCES.id)).toEqual(
      normalizePreferences({ id: DEFAULT_PREFERENCES.id, theme: "dark" }),
    );
  });
});

describe("preference normalization helpers", () => {
  it("detects records that need migration", () => {
    expect(preferencesNeedMigration({ id: DEFAULT_PREFERENCES.id, theme: "dark" })).toBe(true);
    expect(preferencesNeedMigration(normalizePreferences({ theme: "dark" }))).toBe(false);
  });

  it("flags invalid enum and boolean values for migration", () => {
    expect(
      preferencesNeedMigration({
        ...DEFAULT_PREFERENCES,
        theme: "sepia" as never,
      }),
    ).toBe(true);
    expect(
      preferencesNeedMigration({
        ...DEFAULT_PREFERENCES,
        showImages: "yes" as never,
      }),
    ).toBe(true);
  });

  it("normalizes invalid preference payloads back to defaults", () => {
    expect(
      normalizePreferences({
        theme: "unknown" as never,
        fontSize: Number.NaN,
        fontFamily: "",
        readingWidth: "xxl" as never,
        layout: "masonry" as never,
        showImages: "yes" as never,
        keyboardShortcuts: {
          " ": "",
        },
      }),
    ).toEqual(
      expect.objectContaining({
        theme: DEFAULT_PREFERENCES.theme,
        fontSize: DEFAULT_PREFERENCES.fontSize,
        fontFamily: DEFAULT_PREFERENCES.fontFamily,
        readingWidth: DEFAULT_PREFERENCES.readingWidth,
        layout: DEFAULT_PREFERENCES.layout,
        showImages: DEFAULT_PREFERENCES.showImages,
        keyboardShortcuts: expect.objectContaining(DEFAULT_PREFERENCES.keyboardShortcuts),
      }),
    );
  });

  it("preserves customized shortcut remaps while backfilling new defaults", () => {
    const normalized = normalizePreferences({
      keyboardShortcuts: {
        x: "archive",
        j: "next_article",
        k: "previous_article",
        m: "mark_as_read",
        s: "star",
        v: "open_original",
        r: "refresh",
        "/": "search",
        "g h": "go_home",
        "g s": "go_starred",
        "g u": "go_unread",
        escape: "close_modal",
        "?": "show_shortcuts",
        "[": "toggle_sidebar",
        "ctrl+k": "focus_search",
        "meta+k": "focus_search",
      },
    });

    expect(normalized.keyboardShortcuts.x).toBe("archive");
    expect(normalized.keyboardShortcuts.a).toBeUndefined();
    expect(normalized.keyboardShortcuts["g a"]).toBe("go_all");
  });
});
