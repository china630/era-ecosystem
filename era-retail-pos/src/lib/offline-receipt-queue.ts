const DB_NAME = "era-retail-offline";
const STORE = "receipts";
const CLIENT_KEY = "era-retail-offline-client-id";

export type OfflineReceiptPayload = {
  shiftId: string;
  lines: Record<string, unknown>[];
  paymentMethod?: string;
  promoCode?: string;
  customerPhone?: string;
  loyaltyRef?: string;
  createdAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

export function getOfflineClientId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(CLIENT_KEY);
  if (!id) {
    id = `ret-${crypto.randomUUID()}`;
    localStorage.setItem(CLIENT_KEY, id);
  }
  return id;
}

export function isOfflineQueueEnabled(): boolean {
  return process.env.NEXT_PUBLIC_OFFLINE_QUEUE_ENABLED === "true";
}

export async function enqueueOfflineReceipt(
  payload: OfflineReceiptPayload,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({ payload, queuedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function flushOfflineQueue(): Promise<number> {
  const db = await openDb();
  const rows: { id: number; payload: OfflineReceiptPayload }[] = await new Promise(
    (resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () =>
        resolve(
          (req.result as { id: number; payload: OfflineReceiptPayload }[]) ?? [],
        );
      req.onerror = () => reject(req.error);
    },
  );
  db.close();
  if (!rows.length) return 0;

  const clientId = getOfflineClientId();
  const res = await fetch("/api/offline/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId,
      receipts: rows.map((r) => r.payload),
    }),
  });
  if (!res.ok) throw new Error("Offline sync failed");

  const db2 = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db2.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const row of rows) store.delete(row.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db2.close();
  return rows.length;
}
