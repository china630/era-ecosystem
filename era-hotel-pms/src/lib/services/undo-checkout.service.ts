import { hotelDateKey } from '@/lib/hotel-calendar';
import { prisma } from '@/lib/prisma';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';
import { getReservation } from '@/lib/services/reservation.service';

export async function undoCheckout(
  id: string,
  reason: string,
  audit?: { userId?: string | null; request?: Request },
) {
  const note = reason.trim();
  if (!note) throw new Error('RESTORE_REASON_REQUIRED');

  const reservation = await getReservation(id);
  if (reservation.status !== 'CHECKED_OUT') {
    throw new Error('Only a checked-out stay can be restored');
  }

  const stay = await prisma.stay.findFirst({
    where: { reservationId: id },
    orderBy: { createdAt: 'desc' },
  });
  const biz = await getCurrentBusinessDate();
  const checkoutDay = stay?.actualCheckOut ? hotelDateKey(stay.actualCheckOut) : hotelDateKey(biz);
  const transferred = await prisma.folio.count({
    where: { reservationId: id, status: { in: ['PENDING_AR', 'TRANSFERRED_AR'] } },
  });
  const afterNa = checkoutDay < hotelDateKey(biz) || transferred > 0;
  const nextStatus = afterNa ? 'CONFIRMED' : 'IN_HOUSE';

  const updated = await prisma.$transaction(async (tx) => {
    if (!afterNa) {
      await tx.folio.updateMany({
        where: { reservationId: id, type: 'GUEST', status: 'CLOSED' },
        data: { status: 'OPEN' },
      });
      await tx.stay.updateMany({
        where: { reservationId: id },
        data: { actualCheckOut: null },
      });
      if (reservation.roomId) {
        await tx.room.update({
          where: { id: reservation.roomId },
          data: { status: 'OCCUPIED' },
        });
      }
    }
    return tx.reservation.update({
      where: { id },
      data: { status: nextStatus },
      include: { room: true, guest: true, ratePlan: true, roomType: true },
    });
  });

  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  await recordReservationAudit(id, 'RESTORE', audit, {
    section: 'status',
    source: 'user',
    fields: [
      { key: 'status', from: 'CHECKED_OUT', to: nextStatus },
      { key: 'reason', from: null, to: note },
      { key: 'restoreMode', from: null, to: afterNa ? 'after-na' : 'before-na' },
    ],
  });
  return { reservation: updated, mode: afterNa ? 'after-na' : 'before-na' };
}
