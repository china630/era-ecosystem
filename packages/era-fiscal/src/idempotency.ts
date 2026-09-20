import type { SaleResult } from "./types";

export type IdempotencyStore = {
  get(key: string): SaleResult | undefined;
  set(key: string, value: SaleResult): void;
  clear(): void;
};

export function idempotencyKey(
  organizationId: string,
  documentRef: string,
  fiscalDeviceId: string,
): string {
  return `${organizationId}|${documentRef}|${fiscalDeviceId}`;
}

export function createMemoryIdempotencyStore(): IdempotencyStore {
  const map = new Map<string, SaleResult>();
  return {
    get(key) {
      return map.get(key);
    },
    set(key, value) {
      map.set(key, value);
    },
    clear() {
      map.clear();
    },
  };
}

let globalStore: IdempotencyStore = createMemoryIdempotencyStore();

export function getIdempotencyStore(): IdempotencyStore {
  return globalStore;
}

export function setIdempotencyStore(store: IdempotencyStore): void {
  globalStore = store;
}

export function resetIdempotencyStoreForTests(): void {
  globalStore = createMemoryIdempotencyStore();
}
