/**
 * Clinic cutover glue: WO hotelResNo → Guest.globalPersonId.
 * Reservation.externalRef is Elektraweb RESID; elektrawebResNameId is RESNAMEID.
 */

export type StayGuestRef = {
  globalPersonId: string | null;
};

export type StayPersonLookupInput = {
  guest: StayGuestRef | null;
  reservationGuests: Array<{
    sortOrder: number;
    isPrimary: boolean;
    guest: StayGuestRef | null;
  }>;
};

export function pickStayGlobalPersonId(
  stay: StayPersonLookupInput,
  folioPerson?: number | null,
): string | null {
  const guests = stay.reservationGuests ?? [];
  if (folioPerson != null && Number.isFinite(folioPerson) && folioPerson > 0) {
    const byOrder =
      guests.find((g) => g.sortOrder === folioPerson - 1) ||
      guests.find((g) => g.sortOrder === folioPerson);
    const fromShare = byOrder?.guest?.globalPersonId?.trim();
    if (fromShare) return fromShare;
  }
  const primary = guests.find((g) => g.isPrimary)?.guest?.globalPersonId?.trim();
  if (primary) return primary;
  return stay.guest?.globalPersonId?.trim() || null;
}
