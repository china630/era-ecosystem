import { prisma } from '@/lib/prisma';
import { getReservation } from '@/lib/services/reservation.service';

export async function deleteEmptyReservation(
  id: string,
  reason: string,
  audit?: { userId?: string | null; request?: Request },
) {
  const note = reason.trim();
  if (!note) throw new Error('DELETE_REASON_REQUIRED');

  const reservation = await getReservation(id);
  if (!['OPTION', 'CONFIRMED', 'CHECKED_OUT'].includes(reservation.status)) {
    throw new Error('Only an unused option, confirmed, or checked-out stay can be deleted');
  }

  const folios = await prisma.folio.findMany({
    where: { reservationId: id },
    include: {
      charges: { take: 1 },
      payments: { take: 1 },
      fiscalDocuments: { take: 1 },
    },
  });
  const hasMoney = folios.some(
    (folio) => folio.charges.length > 0 || folio.payments.length > 0 || folio.fiscalDocuments.length > 0,
  );
  const deposits = await prisma.folioDeposit.count({ where: { reservationId: id } }).catch(() => 0);
  if (hasMoney || deposits > 0) {
    throw Object.assign(new Error('Stay has folio money and cannot be deleted'), {
      status: 409,
      code: 'FOLIO_HAS_MONEY',
    });
  }

  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  await recordReservationAudit(id, 'DELETE', audit, {
    section: 'status',
    source: 'user',
    fields: [
      { key: 'status', from: reservation.status, to: null },
      { key: 'reason', from: null, to: note },
    ],
  });

  await prisma.reservation.delete({ where: { id } });
  return { id, deleted: true };
}
