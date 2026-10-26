/** Keep a person-level departure when the stay card rewrites party rows. */

export function partyDepartedAt(value: string | Date | null | undefined): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = value?.trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isDepartedPartyRow(row: {
  departedAt?: string | Date | null;
  guestState?: string | null;
}): boolean {
  if (partyDepartedAt(row.departedAt)) return true;
  return row.guestState === 'DEPARTED';
}

/** Prefer a live guest marked primary. A departed row is never the contact. */
export function primaryIndexForParty(
  rows: Array<{ isPrimary?: boolean; departedAt?: string | Date | null; guestState?: string | null }>,
): number {
  const marked = rows.findIndex((row) => row.isPrimary && !isDepartedPartyRow(row));
  if (marked >= 0) return marked;
  const live = rows.findIndex((row) => !isDepartedPartyRow(row));
  return live >= 0 ? live : 0;
}
