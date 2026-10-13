import { prisma } from '@/lib/prisma';
import { guestComposedFullName } from '@/lib/guest-identity.shared';
import { ymdParam } from '@/lib/reports/civil-days';
import { dispatchStayProductChanged } from '@/lib/integration/guest-lifecycle-events';

const OPEN_STAY = ['OPTION', 'CONFIRMED', 'IN_HOUSE'] as const;

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').trim() === (b ?? '').trim();
}

/**
 * Copy the guest card name onto open stays and tell clinic.
 * Checked-out stays keep the name they had.
 */
export async function syncGuestNameToOpenStays(guestId: string): Promise<number> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      fullName: true,
      globalPersonId: true,
      sex: true,
      birthDate: true,
      nationality: true,
    },
  });
  if (!guest) return 0;
  if (!guest.firstName?.trim() || !guest.lastName?.trim()) return 0;

  const rows = await prisma.reservationGuest.findMany({
    where: {
      guestId,
      reservation: { status: { in: [...OPEN_STAY] } },
    },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      reservationId: true,
      reservation: {
        select: {
          status: true,
          room: { select: { roomNumber: true } },
        },
      },
    },
  });

  let changed = 0;
  for (const row of rows) {
    if (
      sameText(row.firstName, guest.firstName) &&
      sameText(row.middleName, guest.middleName) &&
      sameText(row.lastName, guest.lastName)
    ) {
      continue;
    }
    await prisma.reservationGuest.update({
      where: { id: row.id },
      data: {
        firstName: guest.firstName,
        middleName: guest.middleName,
        lastName: guest.lastName,
      },
    });
    changed += 1;
  }

  const inHouse = rows.filter((row) => row.reservation.status === 'IN_HOUSE');
  if (changed > 0 && inHouse.length > 0) {
    const guestName =
      guestComposedFullName(guest) || guest.fullName.trim() || 'Guest';
    const birthDate = guest.birthDate ? ymdParam(guest.birthDate) : undefined;
    for (const row of inHouse) {
      void dispatchStayProductChanged({
        reservationId: row.reservationId,
        effectiveDate: new Date().toISOString(),
        globalPersonId: guest.globalPersonId ?? undefined,
        guestName,
        roomNumber: row.reservation.room?.roomNumber ?? undefined,
        paxKey: row.id,
        sex: guest.sex ?? undefined,
        birthDate,
        nationality: guest.nationality || undefined,
      }).catch((error) => console.error('Guest name clinic sync failed', error));
    }
  }

  return changed;
}

/** Open stays whose party name disagrees with the guest card. */
export async function alignAllOpenStayNames(): Promise<number> {
  const rows = await prisma.reservationGuest.findMany({
    where: {
      guestId: { not: null },
      reservation: { status: { in: [...OPEN_STAY] } },
    },
    select: {
      guestId: true,
      firstName: true,
      middleName: true,
      lastName: true,
      guest: { select: { firstName: true, middleName: true, lastName: true } },
    },
  });
  const guestIds = new Set<string>();
  for (const row of rows) {
    if (!row.guestId || !row.guest) continue;
    if (!row.guest.firstName?.trim() || !row.guest.lastName?.trim()) continue;
    if (
      sameText(row.firstName, row.guest.firstName) &&
      sameText(row.middleName, row.guest.middleName) &&
      sameText(row.lastName, row.guest.lastName)
    ) {
      continue;
    }
    guestIds.add(row.guestId);
  }
  let changed = 0;
  for (const guestId of guestIds) {
    changed += await syncGuestNameToOpenStays(guestId);
  }
  return changed;
}
