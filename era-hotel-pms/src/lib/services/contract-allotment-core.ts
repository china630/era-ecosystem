/** Pure helpers for contract allotment availability (unit-tested). */

export function eachNight(from: Date, to: Date): Date[] {
  const nights: Date[] = [];
  const cursor = new Date(from.toISOString().slice(0, 10));
  const end = new Date(to.toISOString().slice(0, 10));
  while (cursor < end) {
    nights.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return nights;
}

/** Nights available under a specific contract allotment for one stay night. */
export function computeContractNightAvailable(
  nightlyQuota: number,
  contractBooked: number,
  roomAvailable: number,
): { available: number; contractAvailable: number } {
  const contractAvailable = Math.max(0, nightlyQuota - contractBooked);
  return { available: Math.min(roomAvailable, contractAvailable), contractAvailable };
}

/** BAR pool after contract blocks are reserved (contract block > OTA > BAR). */
export function computeBarPoolAfterContractHold(
  baseQuota: number,
  overlapping: number,
  contractQuota: number,
  contractBooked: number,
): number {
  const contractHeld = Math.max(contractQuota - contractBooked, 0);
  return Math.max(0, baseQuota - contractHeld - (overlapping - contractBooked));
}

export function computeUtilizationPercent(
  allotmentNights: number,
  consumedNights: number,
): number | null {
  if (allotmentNights <= 0) return null;
  return Math.round((consumedNights / allotmentNights) * 10000) / 100;
}
