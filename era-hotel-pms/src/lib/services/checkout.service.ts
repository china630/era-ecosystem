import { prisma } from '@/lib/prisma';
import { dispatchReservationCompleted } from '@/lib/integration/event-dispatcher';
import type { DispatchResult } from '@/lib/integration/event-types';
import { assertZeroBalance, closeFolios } from '@/lib/services/folio.service';
import { createFiscalDocumentsOnCheckout } from '@/lib/services/fiscal-document.service';
import { getReservation } from '@/lib/services/reservation.service';

export interface CheckoutResult {
  reservation: Awaited<ReturnType<typeof getReservation>>;
  dispatch: DispatchResult;
}

export async function checkoutReservation(id: string): Promise<CheckoutResult> {
  const existing = await getReservation(id);
  if (existing.status !== 'IN_HOUSE') {
    throw new Error('Check-out is only allowed for IN_HOUSE reservations');
  }

  await assertZeroBalance(id);

  const completed = await prisma.$transaction(async (tx) => {
    await closeFolios(id);

    const reservation = await tx.reservation.update({
      where: { id },
      data: { status: 'CHECKED_OUT' },
      include: {
        room: { include: { roomType: true } },
        guest: true,
        ratePlan: true,
        folios: {
          include: {
            charges: { include: { revenueCode: true } },
            payments: true,
          },
        },
      },
    });

    await tx.stay.updateMany({
      where: { reservationId: id },
      data: { actualCheckOut: new Date() },
    });

    if (reservation.roomId) {
      await tx.room.update({
        where: { id: reservation.roomId },
        data: { status: 'DIRTY' },
      });
      await tx.housekeepingTask.create({
        data: { roomId: reservation.roomId, status: 'PENDING', notes: 'Post check-out' },
      });
    }

    return reservation;
  });

  const dispatch = await dispatchReservationCompleted(completed);
  const { notifyFbPosReservationLifecycle } = await import(
    '@/lib/integration/fb-pos-webhook'
  );
  void notifyFbPosReservationLifecycle({
    eventType: 'reservation_checked_out',
    reservationId: id,
    roomNumber: completed.room?.roomNumber ?? null,
    timestamp: new Date().toISOString(),
  });
  await createFiscalDocumentsOnCheckout(id);
  const { submitTourismCheckOut } = await import('@/lib/services/tourism.service');
  void submitTourismCheckOut(id).catch((e) => console.error('Tourism check-out failed', e));
  const reservation = await getReservation(id);

  return { reservation, dispatch };
}
