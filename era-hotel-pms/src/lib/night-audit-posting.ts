import { AsyncLocalStorage } from 'node:async_hooks';

const posting = new AsyncLocalStorage<true>();

/** Night audit's own charges run inside this. Reception posts on other requests still see the lock. */
export function withNightAuditPosting<T>(fn: () => Promise<T>): Promise<T> {
  return posting.run(true, fn);
}

export function isNightAuditPosting(): boolean {
  return posting.getStore() === true;
}
