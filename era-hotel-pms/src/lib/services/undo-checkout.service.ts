import { hotelDateKey } from '@/lib/hotel-calendar';
import { parseEarlyCheckoutRevert, type EarlyCheckoutRevert } from '@/lib/early-checkout-revert';
import { toDecimal } from '@/lib/decimal';
import { prisma } from '@/lib/prisma';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';
import { getReservation } from '@/lib/services/reservation.service';

function revertFromAuditJson(changesJson: string): EarlyCheckoutRevert | null {
  try {
    const parsed = JSON.parse(changesJson) as { refs?: { earlyCheckout?: unknown } };
    const raw = parsed.refs?.earlyCheckout;
    const body = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parseEarlyCheckoutRevert(body);
  } catch {
    return null;
  }
}

async function latestEarlyCheckoutRevert(reservationId: string): Promise<EarlyCheckoutRevert | null> {
  const logs = await prisma.satelliteAuditLog.findMany({
    where: {
      entityType: 'Reservation',
      entityId: reservationId,
      action: { in: ['CHECK_OUT', 'EARLY_CHECKOUT'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { changesJson: true },
  });
  for (const log of logs) {
    const revert = revertFromAuditJson(log.changesJson);
    if (revert) return revert;
  }
  return null;
}

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
  const revert = afterNa ? null : await latestEarlyCheckoutRevert(id);

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
      if (revert) {
        await tx.reservation.update({
          where: { id },
          data: {
            checkOutDate: new Date(revert.checkOut),
            totalAmount: toDecimal(Number(revert.totalAmount)),
          },
        });
        for (const rate of revert.rates) {
          const stayDate = new Date(rate.stayDate);
          const existingRate = await tx.reservationDailyRate.findFirst({
            where: { reservationId: id, stayDate },
            select: { id: true },
          });
          if (existingRate) continue;
          await tx.reservationDailyRate.create({
            data: {
              organizationId: reservation.organizationId,
              reservationId: id,
              stayDate,
              amount: toDecimal(Number(rate.amount)),
              tariffAmount: rate.tariffAmount == null ? null : toDecimal(Number(rate.tariffAmount)),
              currencyCode: rate.currencyCode,
              fixPrice: rate.fixPrice,
              discountPct: rate.discountPct == null ? null : toDecimal(Number(rate.discountPct)),
              manualFlag: rate.manualFlag,
            },
          });
        }
        for (const slice of revert.slices) {
          const row = await tx.reservationStaySlice.findUnique({ where: { id: slice.id } });
          if (!row) {
            await tx.reservationStaySlice.create({
              data: {
                id: slice.id,
                organizationId: slice.organizationId,
                reservationId: id,
                fromDate: new Date(slice.fromDate),
                toDate: new Date(slice.toDate),
                roomId: slice.roomId,
                roomTypeId: slice.roomTypeId,
                ratePlanId: slice.ratePlanId,
              },
            });
            continue;
          }
          await tx.reservationStaySlice.update({
            where: { id: slice.id },
            data: { toDate: new Date(slice.toDate) },
          });
        }
      }
    }
    // Keep settlement status when City Ledger AR folios remain (after-NA restore).
    const settlementPatch =
      transferred > 0
        ? {}
        : { checkoutSettlementStatus: 'NOT_APPLICABLE' as const };

    return tx.reservation.update({
      where: { id },
      data: {
        status: nextStatus,
        ...settlementPatch,
      },
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
      ...(revert
        ? [{ key: 'checkOutDate', from: null, to: revert.checkOut.slice(0, 10) }]
        : []),
    ],
  });
  return { reservation: updated, mode: afterNa ? 'after-na' : 'before-na' };
}
