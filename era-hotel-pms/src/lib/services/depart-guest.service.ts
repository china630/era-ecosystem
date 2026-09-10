import { prisma } from '@/lib/prisma';
import { isEffectiveShare } from '@/lib/services/share-assignment.service';
import { closeFolio } from '@/lib/services/folio.service';
import { recalcReservationDailyRates } from '@/lib/services/reservation-pricing.service';
import { dispatchGuestDeparted } from '@/lib/integration/guest-lifecycle-events';
import { addReservationTask } from '@/lib/services/reservation-submodals.service';
import {
  countLivePax,
  previewOccupancyAfterDepart,
} from '@/lib/occupancy-party';

export {
  occupancyBucketForPax,
  decrementOccupancy,
  countLivePax,
  previewOccupancyAfterDepart,
  type OccupancyCounts,
} from '@/lib/occupancy-party';

export const REISSUE_KEY_TASK_TITLE =
  'Reissue key card after party/room change';

export type DepartFolioMode = 'LEAVE_ON_PRIMARY' | 'CLOSE_PERSONAL';

/**
 * Depart one party member while RoomStay stays IN_HOUSE (ADR D4).
 * Last live pax → needs_checkout (FO must use stay checkout UI — no blind checkoutReservation).
 */
export async function departGuestFromStay(
  reservationId: string,
  paxId: string,
  opts?: {
    departedAt?: Date;
    folioMode?: DepartFolioMode;
  },
) {
  const departedAt = opts?.departedAt ?? new Date();
  const folioMode = opts?.folioMode ?? 'LEAVE_ON_PRIMARY';

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      paxGuests: {
        orderBy: { sortOrder: 'asc' },
        include: { guest: true },
      },
      guest: true,
      room: true,
      ratePlan: true,
      agency: true,
      folios: true,
    },
  });
  if (!reservation) throw new Error('Reservation not found');
  if (reservation.status !== 'IN_HOUSE') {
    throw new Error('Depart guest is only allowed for IN_HOUSE stays');
  }
  if (
    isEffectiveShare({
      shareEligible: reservation.shareEligible,
      shareGender: reservation.shareGender,
      adults: reservation.adults,
    })
  ) {
    const err = new Error(
      'Share-pool roommate departure uses stay checkout, not Depart guest',
    );
    (err as Error & { status?: number }).status = 409;
    throw err;
  }

  const pax = reservation.paxGuests.find((p) => p.id === paxId);
  if (!pax) throw new Error('Party guest not found on this stay');
  if (pax.departedAt) throw new Error('Guest already departed');

  const liveRemaining = countLivePax(reservation.paxGuests, paxId);
  if (liveRemaining === 0) {
    return {
      kind: 'needs_checkout' as const,
      reservationId,
      paxId,
      folioPath: `/folio/${reservationId}`,
      message:
        'Last in-house guest — complete stay checkout on the folio (Depart guest does not check out the room)',
    };
  }

  const nextOcc = previewOccupancyAfterDepart(
    {
      adults: reservation.adults,
      children11_6: reservation.children11_6,
      children5_2: reservation.children5_2,
      children1_0: reservation.children1_0,
    },
    { age: pax.age },
  );

  await prisma.$transaction(async (tx) => {
    await tx.reservationGuest.update({
      where: { id: paxId },
      data: {
        departedAt,
        guestState: 'DEPARTED',
        isPrimary: false,
        ownsFolio: false,
      },
    });

    if (pax.isPrimary) {
      const nextPrimary = reservation.paxGuests.find(
        (g) => g.id !== paxId && !g.departedAt,
      );
      if (nextPrimary) {
        await tx.reservationGuest.update({
          where: { id: nextPrimary.id },
          data: {
            isPrimary: true,
            ownsFolio: true,
          },
        });
        if (nextPrimary.guestId) {
          await tx.reservation.update({
            where: { id: reservationId },
            data: { guestId: nextPrimary.guestId },
          });
        }
        if (reservation.partyBillingMode === 'PRIMARY') {
          await tx.reservationGuest.updateMany({
            where: {
              reservationId,
              id: { not: nextPrimary.id },
              departedAt: null,
            },
            data: { ownsFolio: false, isPrimary: false },
          });
        }
      }
    }

    await tx.reservation.update({
      where: { id: reservationId },
      data: {
        adults: nextOcc.adults,
        children11_6: nextOcc.children11_6,
        children5_2: nextOcc.children5_2,
        children1_0: nextOcc.children1_0,
      },
    });

    if (reservation.roomId) {
      // Stayover / pickup — never DIRTY while other party remains in-house (ADR D4).
      await tx.room.update({
        where: { id: reservation.roomId },
        data: { hkCondition: 'PICKUP' },
      });
      await tx.housekeepingTask.create({
        data: {
          roomId: reservation.roomId,
          status: 'PENDING',
          notes: `Party departure (Depart guest), roommate remains — ${pax.firstName ?? ''} ${pax.lastName ?? ''}`.trim(),
          jobType: 'STAYOVER',
        },
      });
    }
  });

  if (folioMode === 'CLOSE_PERSONAL') {
    const personal = reservation.folios.find(
      (f) => f.reservationGuestId === paxId && f.type === 'GUEST' && f.status === 'OPEN',
    );
    if (personal) {
      await closeFolio(personal.id).catch(() => undefined);
    }
  }

  await recalcReservationDailyRates(reservationId, {
    remainingFrom: departedAt,
  }).catch((e) => console.error('Depart guest pricing recalc failed', e));

  const guestName = [pax.firstName, pax.lastName].filter(Boolean).join(' ').trim();
  const paxGlobalPersonId =
    pax.guest?.globalPersonId ?? reservation.guest?.globalPersonId ?? undefined;
  await dispatchGuestDeparted({
    reservationId,
    paxKey: paxId,
    roomNumber: reservation.room?.roomNumber,
    programCode: reservation.ratePlan?.medicalFlag ? reservation.ratePlan.code : undefined,
    globalPersonId: paxGlobalPersonId,
    guestName: guestName || undefined,
    checkOutDate: departedAt.toISOString(),
  }).catch((e) => console.error('Depart guest lifecycle failed', e));

  await addReservationTask(reservationId, { title: REISSUE_KEY_TASK_TITLE }).catch(
    () => undefined,
  );

  const updated = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      paxGuests: { orderBy: { sortOrder: 'asc' } },
      guest: true,
      room: true,
    },
  });

  return {
    kind: 'departed' as const,
    reservation: updated,
    departedPaxId: paxId,
    occupancy: nextOcc,
  };
}
