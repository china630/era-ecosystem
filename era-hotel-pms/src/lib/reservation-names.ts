/**
 * FO gate: guest names not ready for assign / check-in (TBA / incomplete party).
 */

const TBA_NAME_RE =
  /^(tba|t\.?\s*b\.?\s*a\.?|to be announced|group\s*holder|qrup|группа|имя\s*позже|ad\s*sonra)/i;

export function isTbaDisplayName(name: string | null | undefined): boolean {
  const n = (name ?? '').trim();
  if (!n) return true;
  return TBA_NAME_RE.test(n);
}

export function paxHasRealName(row: {
  firstName?: string | null;
  lastName?: string | null;
}): boolean {
  return Boolean((row.firstName ?? '').trim() || (row.lastName ?? '').trim());
}

/** Incomplete when primary guest looks like TBA, or named pax < adults. */
export function reservationNamesIncomplete(input: {
  guestFullName?: string | null;
  adults: number;
  pax: Array<{ firstName?: string | null; lastName?: string | null; isPrimary?: boolean }>;
}): boolean {
  if (isTbaDisplayName(input.guestFullName)) return true;
  const named = input.pax.filter(paxHasRealName).length;
  const adults = Math.max(1, input.adults || 1);
  return named < adults;
}
