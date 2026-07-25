/**
 * مكتبة محلية داخل المتصفح (IndexedDB) — تعمل بدون حساب أو إعداد Supabase،
 * وتُستخدم كبديل تلقائي عندما لا يكون المستخدم مسجلاً.
 */

export type LocalItem = {
  id: string;
  kind: "tts" | "song" | "recording";
  title: string;
  details: string;
  mimeType: string;
  createdAt: number;
  blob: Blob;
};

const DB_NAME = "maqam-library";
const STORE = "items";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

export function localSave(item: LocalItem): Promise<unknown> {
  return tx("readwrite", (store) => store.put(item));
}

export async function localList(): Promise<LocalItem[]> {
  const items = await tx<LocalItem[]>("readonly", (store) => store.getAll());
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export function localRemove(id: string): Promise<unknown> {
  return tx("readwrite", (store) => store.delete(id));
}
