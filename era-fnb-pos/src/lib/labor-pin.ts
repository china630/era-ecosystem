import { createHash, timingSafeEqual } from "crypto";

/** SHA-256 PIN hash used by `/api/labor/clock` (AC-FNB-LABOR). */
export function hashStaffPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

const DUMMY_PIN_HASH = hashStaffPin("timing-pad");

export function pinMatches(storedHash: string | null | undefined, pin: string): boolean {
  const derived = Buffer.from(hashStaffPin(pin), "hex");
  const stored = Buffer.from(
    storedHash && storedHash.length === DUMMY_PIN_HASH.length
      ? storedHash
      : DUMMY_PIN_HASH,
    "hex",
  );
  if (stored.length !== derived.length) return false;
  return timingSafeEqual(stored, derived) && Boolean(storedHash);
}
