/**
 * Minimal promise wrapper around IndexedDB (no dependency). Browser-only.
 *
 * Stores:
 *   packs     – downloaded offline quiz packs (with answers; see server/offline.ts trade-off)
 *   queue     – finished offline rounds waiting to sync
 *   profiles  – profiles created on this device that are still waiting for parental consent.
 *               These never leave the device until consent is confirmed (PDPA §3.1 in PRD).
 */
const DB_NAME = "schoolpawa";
const VERSION = 1;
export type StoreName = "packs" | "queue" | "profiles";

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("packs")) db.createObjectStore("packs", { keyPath: "key" });
      if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", { keyPath: "clientResultId" });
      if (!db.objectStoreNames.contains("profiles")) db.createObjectStore("profiles", { keyPath: "localId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const idb = {
  get: <T>(store: StoreName, key: string) => tx<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>),
  all: <T>(store: StoreName) => tx<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>),
  put: <T>(store: StoreName, value: T) => tx<IDBValidKey>(store, "readwrite", (s) => s.put(value)),
  del: (store: StoreName, key: string) => tx<undefined>(store, "readwrite", (s) => s.delete(key)),
};

export function idbAvailable() {
  return typeof indexedDB !== "undefined";
}
