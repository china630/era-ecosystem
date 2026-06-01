/**
 * Client-side offline queue for pay/fire actions (IndexedDB).
 * Replay via POST /api/offline/replay when back online.
 */

const DB_NAME = "era_fb_offline";
const STORE = "actions";
const DB_VERSION = 1;

export type OfflineAction = {
  id: string;
  kind: "pay" | "fire";
  ticketId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

export async function enqueueOfflineAction(
  action: Omit<OfflineAction, "id" | "createdAt">,
): Promise<string> {
  const id = crypto.randomUUID();
  const row: OfflineAction = {
    ...action,
    id,
    createdAt: new Date().toISOString(),
  };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(row);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listOfflineActions(): Promise<OfflineAction[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as OfflineAction[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function removeOfflineAction(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
