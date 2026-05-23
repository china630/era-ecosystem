import { dispatchMasterDataSync } from '@/lib/integration/event-dispatcher';

let timer: ReturnType<typeof setTimeout> | null = null;

/** Debounced E5 push after master-data POST (revenue code / department). */
export function scheduleMasterDataSyncDebounced(delayMs = 5000) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    dispatchMasterDataSync().catch((err) => console.error('E5 master data sync failed', err));
  }, delayMs);
}
