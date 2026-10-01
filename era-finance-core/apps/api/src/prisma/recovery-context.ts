import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Recovery / super-admin: skip soft-delete filters and allow physical mutations when needed.
 * Set via `runWithRecoveryContext` around rollback, snapshot restore, or admin repair jobs.
 */
export type RecoveryContextStore = {
  includeSoftDeleted: boolean;
};

export const recoveryContextStorage = new AsyncLocalStorage<RecoveryContextStore>();

export function getRecoveryContext(): RecoveryContextStore | undefined {
  return recoveryContextStorage.getStore();
}

export function isIncludeSoftDeleted(): boolean {
  return Boolean(getRecoveryContext()?.includeSoftDeleted);
}

export function runWithRecoveryContext<T>(store: RecoveryContextStore, fn: () => T): T {
  return recoveryContextStorage.run(store, fn);
}

export async function runWithRecoveryContextAsync<T>(
  store: RecoveryContextStore,
  fn: () => Promise<T>,
): Promise<T> {
  return recoveryContextStorage.run(store, fn);
}
