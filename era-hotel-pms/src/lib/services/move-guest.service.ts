import { prisma } from '@/lib/prisma';
import { isEffectiveShare } from '@/lib/services/share-assignment.service';
import { recalcReservationDailyRates } from '@/lib/services/reservation-pricing.service';
import {
  occupancyBucketForPax,
  decrementOccupancy,
  REISSUE_KEY_TASK_TITLE,
  type OccupancyCounts,
} from '@/lib/services/depart-guest.service';
import { dispatchGuestMoved } from '@/lib/integration/guest-lifecycle-events';
import { addReservationTask } from '@/lib/services/reservation-submodals.service';

function bumpOccupancy(current: OccupancyCounts, bucket: keyof OccupancyCounts): OccupancyCounts {
  return { ...current, [bucket]: current[bucket] + 1 };
}

/**
 * Move a live ReservationGuest to a sibling RoomStay in the same ReservationGroup (ADR D5).
 * Keeps pax id (= clinic paxKey) stable.
 */
export async function moveGuestBetweenStays(
  fromReservationId: string,
  paxId: string,
  toReservationId: string,
  opts?: { effectiveDate?: Date },
) {
  if (fromReservationId === toReservationId) {
    throw new Error('Destination stay must differ');
  }

  const [from, to] = await Promise.all([
    prisma.reservation.findUnique({
      where: { id: fromReservationId },
      include: {
        paxGuests: { include: { guest: true } },
        guest: true,
        room: true,
        ratePlan: true,
        group: true,
      },
    }),
    prisma.reservation.findUnique({
      where: { id: toReservationId },
      include: {
        paxGuests: true,
        room: true,
        ratePlan: true,
        group: true,
      },
    }),
  ]);

  if (!from || !to) throw new Error('Reservation not found');
  if (!from.groupId || from.groupId !== to.groupId) {
    const err = new Error('Move guest only within the same booking group');
    (err as Error & { status?: number }).status = 409;
    throw err;
  }
  if (
    isEffectiveShare({
      shareEligible: from.shareEligible,
      shareGender: from.shareGender,
      adults: from.adults,
    }) ||
    isEffectiveShare({
      shareEligible: to.shareEligible,
      shareGender: to.shareGender,
      adults: to.adults,
    })
  ) {
    const err = new Error('Cannot move guest into or out of a share-pool stay');
    (err as Error & { status?: number }).status = 409;
    throw err;
  }

  const pax = from.paxGuests.find((p) => p.id === paxId);
  if (!pax) throw new Error('Party guest not found on source stay');
  if (pax.departedAt) {
    const err = new Error('Cannot move a departed guest');
    (err as Error & { status?: number }).status = 409;
    throw err;
  }

  const liveOnFrom = from.paxGuests.filter((p) => !p.departedAt && p.id !== paxId);
  if (liveOnFrom.length === 0) {
    const err = new Error('Cannot empty stay — relocate or check out the room first');
    (err as Error & { status?: number }).status = 409;
    throw err;
  }

  const bucket = occupancyBucketForPax({ age: pax.age });
  const fromOcc = decrementOccupancy(
    {
      adults: from.adults,
      children11_6: from.children11_6,
      children5_2: from.children5_2,
      children1_0: from.children1_0,
    },
    bucket,
  );
  if (fromOcc.adults < 1) fromOcc.adults = 1;
  const toOcc = bumpOccupancy(
    {
      adults: to.adults,
      children11_6: to.children11_6,
      children5_2: to.children5_2,
      children1_0: to.children1_0,
    },
    bucket,
  );

  const maxSort = to.paxGuests.reduce((m, p) => Math.max(m, p.sortOrder), -1);

  await prisma.$transaction(async (tx) => {
    await tx.reservationGuest.update({
      where: { id: paxId },
      data: {
        reservationId: toReservationId,
        isPrimary: false,
        ownsFolio: to.partyBillingMode === 'EQUAL',
        sortOrder: maxSort + 1,
      },
    });

    if (pax.isPrimary) {
      const nextPrimary = liveOnFrom[0]!;
      await tx.reservationGuest.update({
        where: { id: nextPrimary.id },
        data: { isPrimary: true, ownsFolio: true },
      });
      if (nextPrimary.guestId) {
        await tx.reservation.update({
          where: { id: fromReservationId },
          data: { guestId: nextPrimary.guestId },
        });
      }
    }

    await tx.reservation.update({
      where: { id: fromReservationId },
      data: {
        adults: fromOcc.adults,
        children11_6: fromOcc.children11_6,
        children5_2: fromOcc.children5_2,
        children1_0: fromOcc.children1_0,
      },
    });
    await tx.reservation.update({
      where: { id: toReservationId },
      data: {
        adults: toOcc.adults,
        children11_6: toOcc.children11_6,
        children5_2: toOcc.children5_2,
        children1_0: toOcc.children1_0,
      },
    });
  });

  const remainingFrom = opts?.effectiveDate ?? new Date();
  await Promise.all([
    recalcReservationDailyRates(fromReservationId, { remainingFrom }).catch(
      () => undefined,
    ),
    recalcReservationDailyRates(toReservationId, { remainingFrom }).catch(
      () => undefined,
    ),
  ]);

  const guestName = [pax.firstName, pax.lastName].filter(Boolean).join(' ').trim();
  const paxGlobalPersonId =
    pax.guest?.globalPersonId ?? from.guest?.globalPersonId ?? undefined;
  await dispatchGuestMoved({
    reservationId: toReservationId,
    fromReservationId,
    toReservationId,
    paxKey: paxId,
    previousRoomNumber: from.room?.roomNumber,
    newRoomNumber: to.room?.roomNumber ?? toReservationId,
    programCode: to.ratePlan?.medicalFlag ? to.ratePlan.code : undefined,
    globalPersonId: paxGlobalPersonId,
    guestName: guestName || undefined,
  }).catch((e) => console.error('Move guest lifecycle failed', e));

  await addReservationTask(toReservationId, { title: REISSUE_KEY_TASK_TITLE }).catch(
    () => undefined,
  );

  return {
    fromReservationId,
    toReservationId,
    paxId,
    effectiveDate: remainingFrom.toISOString().slice(0, 10),
  };
}
