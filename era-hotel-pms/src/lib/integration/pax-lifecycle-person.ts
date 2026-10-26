/**
 * MDM id stamped on a hotel → clinic lifecycle event for one party row.
 * A companion with no own person must not inherit the primary guest's id.
 * Clinic keys the chart on that id and would rename one patient to whoever arrived last.
 */
export function paxLifecycleGlobalPersonId(input: {
  isPrimary?: boolean;
  guestId?: string | null;
  guest?: { id?: string | null; globalPersonId?: string | null } | null;
  primaryGuest?: { id?: string | null; globalPersonId?: string | null } | null;
}): string | undefined {
  const own = input.guest?.globalPersonId?.trim();
  if (own) return own;
  const primaryId = input.primaryGuest?.id?.trim() ?? "";
  const rowGuestId = (input.guestId ?? input.guest?.id ?? "").trim();
  const isThisPrimary =
    input.isPrimary === true || (primaryId.length > 0 && rowGuestId === primaryId);
  if (!isThisPrimary) return undefined;
  const fallback = input.primaryGuest?.globalPersonId?.trim();
  return fallback || undefined;
}
