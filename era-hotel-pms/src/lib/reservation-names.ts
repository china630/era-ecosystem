/**
 * FO gate: guest names not ready for assign / check-in (TBA / incomplete party).
 */

import { isDepartedPartyRow } from '@/lib/party-departed-stamp';

const TBA_NAME_RE =
  /^(tba|t\.?\s*b\.?\s*a\.?|to be announced|group\s*holder|qrup|группа|имя\s*позже|ad\s*sonra)/i;

export function isTbaDisplayName(name: string | null | undefined): boolean {
  const n = (name ?? '').trim();
  if (!n) return true;
  return TBA_NAME_RE.test(n);
}

export type PartyGuestSegment = { name: string; departed: boolean };

/** Named party members for FO lists (departed kept, marked). */
export function partyGuestSegments(
  guestFullName: string | null | undefined,
  pax: Array<{
    firstName?: string | null;
    lastName?: string | null;
    departedAt?: string | Date | null;
    guestState?: string | null;
  }>,
): PartyGuestSegment[] {
  if (pax.length === 0) {
    const name = (guestFullName ?? '').trim();
    return name ? [{ name, departed: false }] : [];
  }
  return pax
    .map((row) => ({
      name: [row.firstName, row.lastName].filter(Boolean).join(' ').trim(),
      departed: isDepartedPartyRow(row),
    }))
    .filter((row) => Boolean(row.name));
}

export function partyGuestLabel(
  guestFullName: string | null | undefined,
  pax: Array<{
    firstName?: string | null;
    lastName?: string | null;
    departedAt?: string | Date | null;
    guestState?: string | null;
  }>,
): string {
  const parts = partyGuestSegments(guestFullName, pax);
  if (parts.length === 0) return (guestFullName ?? '').trim();
  return parts.map((row) => row.name).join(' / ');
}

export function paxHasRealName(row: {
  firstName?: string | null;
  lastName?: string | null;
}): boolean {
  return Boolean((row.firstName ?? '').trim() || (row.lastName ?? '').trim());
}

export function missingAdultNameCount(input: {
  adults: number;
  pax: Array<{ firstName?: string | null; lastName?: string | null }>;
}): number {
  const named = input.pax.filter(paxHasRealName).length;
  const adults = Math.max(1, input.adults || 1);
  return Math.max(0, adults - named);
}
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
