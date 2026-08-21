import { createHash } from "crypto";

/** SHA-256 PIN hash used by `/api/labor/clock` (AC-FNB-LABOR). */
export function hashStaffPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

export function pinMatches(storedHash: string | null | undefined, pin: string): boolean {
  if (!storedHash) return false;
  return storedHash === hashStaffPin(pin);
}
