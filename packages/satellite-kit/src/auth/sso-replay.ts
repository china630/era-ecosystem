/**
 * SEC-SSO-01: one-time SSO signature consume (process-local).
 * Multi-instance deployments should replace with Redis SET NX + TTL.
 */

const used = new Map<string, number>();

function prune(nowSec: number): void {
  for (const [sig, exp] of used) {
    if (exp < nowSec) used.delete(sig);
  }
}

/**
 * Returns true if this signature was not seen before (and records it).
 * Returns false on replay.
 */
export function consumeSsoSignatureOnce(
  signature: string,
  expiresAtSec: number,
): boolean {
  const now = Math.floor(Date.now() / 1000);
  prune(now);
  if (expiresAtSec < now) return false;
  const key = signature.trim().toLowerCase();
  if (!key) return false;
  if (used.has(key)) return false;
  used.set(key, expiresAtSec);
  return true;
}

/** Test helper — clears the in-process replay store. */
export function resetSsoReplayStoreForTests(): void {
  used.clear();
}
