import { afterEach, describe, expect, it, vi } from "vitest";

import { closeDB, openDB, preferences } from "./index";
import { DB_NAME, DB_VERSION, DEFAULT_PREFERENCES, STORES, normalizePreferences } from "./schema";

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

  onversionchange: ((this: IDBDatabase, ev: Event) => unknown) | null = null;

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

  transaction(storeName: string): IDBTransaction {
    return {
      objectStore: (name: string): IDBObjectStore => {
        const store = this.stores.get(name ?? storeName);
        if (!store) {
          throw new Error(`Missing object store: ${name}`);
        }
        return store as unknown as IDBObjectStore;
      },
    } as IDBTransaction;
  }

  close(): void {}
}

class MockOpenRequest {
  error: DOMException | null = null;
  onsuccess: ((this: IDBOpenDBRequest, ev: Event) => unknown) | null = null;
  onerror: ((this: IDBOpenDBRequest, ev: Event) => unknown) | null = null;
  onupgradeneeded: ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown) | null = null;

  readonly result: IDBDatabase;
  readonly transaction: IDBTransaction;

  constructor(db: MockDatabase) {
    this.result = db as unknown as IDBDatabase;
    this.transaction = db.transaction(STORES.PREFERENCES);
  }

  triggerUpgrade(): void {
    this.onupgradeneeded?.call(
      this as unknown as IDBOpenDBRequest,
      { target: this } as IDBVersionChangeEvent,
    );
  }

  triggerSuccess(): void {
    this.onsuccess?.call(this as unknown as IDBOpenDBRequest, { target: this } as Event);
  }
}

async function flushIndexedDbMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  closeDB();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("openDB migrations", () => {
  it("runs upgrade migrations against existing databases when the version changes", async () => {
    const db = new MockDatabase();
    const articles = db.addExistingStore(STORES.ARTICLES, "id", ["feedId"]);
    db.addExistingStore(
      STORES.PREFERENCES,
      "id",
      [],
      [{ id: DEFAULT_PREFERENCES.id, theme: "dark" }],
    );
    const request = new MockOpenRequest(db);
    const open = vi.fn(() => request as unknown as IDBOpenDBRequest);

    vi.stubGlobal("indexedDB", { open });

    const promise = openDB();
    request.triggerUpgrade();
    request.triggerSuccess();
    await promise;
    await flushIndexedDbMicrotasks();

    expect(open).toHaveBeenCalledWith(DB_NAME, DB_VERSION);
    expect(articles.getIndexDefinition("tags")).toEqual({
      keyPath: "tags",
      options: { unique: false, multiEntry: true },
    });
    expect(db.stores.get(STORES.PREFERENCES)?.records.get(DEFAULT_PREFERENCES.id)).toEqual(
      normalizePreferences({ id: DEFAULT_PREFERENCES.id, theme: "dark" }),
    );
  });

  it("self-heals missing preference records even without an upgrade", async () => {
    const db = new MockDatabase();
    db.addExistingStore(STORES.PREFERENCES, "id");
    const request = new MockOpenRequest(db);
    const open = vi.fn(() => request as unknown as IDBOpenDBRequest);

    vi.stubGlobal("indexedDB", { open });

    const promise = openDB();
    request.triggerSuccess();
    await promise;

    expect(await preferences.get()).toEqual(DEFAULT_PREFERENCES);
    expect(db.stores.get(STORES.PREFERENCES)?.records.get(DEFAULT_PREFERENCES.id)).toEqual(
      DEFAULT_PREFERENCES,
    );
  });
});
