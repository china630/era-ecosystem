import type { Phase } from "./copy";
import type { CareTimetableRow } from "./care-types";

export type TripPack = {
  loadedAt: string;
  reservationId: string;
  reservationGuestId: string;
  confirmation: string | null;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  party: Array<{
    id?: string;
    firstName: string | null;
    lastName: string | null;
    isPrimary: boolean;
  }>;
  hotel: { name: string; address: string | null; phone: string | null };
  transfers: Array<{
    direction: string;
    flightNo: string | null;
    pickupAt: string;
    vehicleCode: string | null;
    notes: string | null;
    status: string;
  }>;
};

/** Offline Care slice — text timetable/results/episodes only; no clinic archive blobs. */
export type CareOfflineSlice = {
  loadedAt: string;
  reason?: string | null;
  timetable: CareTimetableRow[];
  results: Array<{ id: string; title?: string }>;
  episodes: Array<{ id: string; label?: string }>;
};

export type CatalogSnapshot = {
  loadedAt: string;
  catalog: string[];
  offers: string[];
};

/** Local outbound order before hotel accepts — never shown as hotel-accepted. */
export type QueuedOrder = {
  localId: string;
  kind: string;
  note?: string;
  createdAt: string;
  status: "QUEUED";
  lastError?: string;
};

const TOKEN_KEY = "guestApp.token";
const TRIP_KEY = "guestApp.trip";
const CARE_KEY = "guestApp.care";
const CATALOG_KEY = "guestApp.catalog";
const QUEUE_KEY = "guestApp.orderQueue";
const MUTE_KEY = "guestApp.muteMarketing";
const BIO_UNLOCK_KEY = "guestApp.bioUnlocked";

type MemoryBag = {
  __guestToken?: string;
  __guestTrip?: TripPack;
  __guestCare?: CareOfflineSlice;
  __guestCatalog?: CatalogSnapshot;
  __guestQueue?: QueuedOrder[];
  __guestMute?: boolean;
};
const memory = globalThis as MemoryBag;

async function readKey(key: string): Promise<string | null> {
  try {
    const mod = await import("@react-native-async-storage/async-storage");
    const v = await mod.default.getItem(key);
    if (v != null) return v;
  } catch {
    /* optional native store */
  }
  try {
    if (typeof localStorage !== "undefined") {
      const v = localStorage.getItem(key);
      if (v != null) return v;
    }
  } catch {
    /* web storage unavailable */
  }
  if (key === TOKEN_KEY) return memory.__guestToken ?? null;
  if (key === TRIP_KEY) {
    return memory.__guestTrip ? JSON.stringify(memory.__guestTrip) : null;
  }
  if (key === CARE_KEY) {
    return memory.__guestCare ? JSON.stringify(memory.__guestCare) : null;
  }
  if (key === CATALOG_KEY) {
    return memory.__guestCatalog ? JSON.stringify(memory.__guestCatalog) : null;
  }
  if (key === QUEUE_KEY) {
    return memory.__guestQueue ? JSON.stringify(memory.__guestQueue) : null;
  }
  if (key === MUTE_KEY) {
    return memory.__guestMute != null ? String(memory.__guestMute) : null;
  }
  return null;
}

async function writeKey(key: string, value: string): Promise<void> {
  if (key === TOKEN_KEY) memory.__guestToken = value;
  if (key === TRIP_KEY) {
    try {
      memory.__guestTrip = JSON.parse(value) as TripPack;
    } catch {
      memory.__guestTrip = undefined;
    }
  }
  if (key === CARE_KEY) {
    try {
      memory.__guestCare = JSON.parse(value) as CareOfflineSlice;
    } catch {
      memory.__guestCare = undefined;
    }
  }
  if (key === CATALOG_KEY) {
    try {
      memory.__guestCatalog = JSON.parse(value) as CatalogSnapshot;
    } catch {
      memory.__guestCatalog = undefined;
    }
  }
  if (key === QUEUE_KEY) {
    try {
      memory.__guestQueue = JSON.parse(value) as QueuedOrder[];
    } catch {
      memory.__guestQueue = undefined;
    }
  }
  if (key === MUTE_KEY) memory.__guestMute = value === "true";
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
  try {
    const mod = await import("@react-native-async-storage/async-storage");
    await mod.default.setItem(key, value);
  } catch {
    /* optional */
  }
}

export async function saveSession(token: string, trip: TripPack): Promise<void> {
  await writeKey(TOKEN_KEY, token);
  await writeKey(TRIP_KEY, JSON.stringify(trip));
}

export async function loadSession(): Promise<{ token: string | null; trip: TripPack | null }> {
  const token = await readKey(TOKEN_KEY);
  const raw = await readKey(TRIP_KEY);
  let trip: TripPack | null = null;
  if (raw) {
    try {
      trip = JSON.parse(raw) as TripPack;
    } catch {
      trip = null;
    }
  }
  return { token, trip };
}

export async function saveCareSlice(slice: CareOfflineSlice): Promise<void> {
  await writeKey(CARE_KEY, JSON.stringify(slice));
}

export async function loadCareSlice(): Promise<CareOfflineSlice | null> {
  const raw = await readKey(CARE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CareOfflineSlice;
  } catch {
    return null;
  }
}

export async function saveCatalogSnapshot(snap: CatalogSnapshot): Promise<void> {
  await writeKey(CATALOG_KEY, JSON.stringify(snap));
}

export async function loadCatalogSnapshot(): Promise<CatalogSnapshot | null> {
  const raw = await readKey(CATALOG_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CatalogSnapshot;
  } catch {
    return null;
  }
}

export async function loadOrderQueue(): Promise<QueuedOrder[]> {
  const raw = await readKey(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedOrder[];
  } catch {
    return [];
  }
}

export async function saveOrderQueue(items: QueuedOrder[]): Promise<void> {
  await writeKey(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueueOrder(kind: string, note?: string): Promise<QueuedOrder> {
  const items = await loadOrderQueue();
  const row: QueuedOrder = {
    localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    note,
    createdAt: new Date().toISOString(),
    status: "QUEUED",
  };
  items.push(row);
  await saveOrderQueue(items);
  return row;
}

export async function setMuteMarketing(muted: boolean): Promise<void> {
  await writeKey(MUTE_KEY, muted ? "true" : "false");
}

export async function loadMuteMarketing(): Promise<boolean> {
  return (await readKey(MUTE_KEY)) === "true";
}

export function phaseFromTrip(trip: TripPack | null, now = new Date()): Phase {
  if (!trip?.checkIn) return "before";
  const inAt = new Date(trip.checkIn).getTime();
  const outAt = trip.checkOut ? new Date(trip.checkOut).getTime() : Number.POSITIVE_INFINITY;
  const t = now.getTime();
  if (t < inAt) return "before";
  if (t > outAt) return "after";
  return "in_house";
}

export { TOKEN_KEY, TRIP_KEY, CARE_KEY, CATALOG_KEY, QUEUE_KEY, BIO_UNLOCK_KEY };
