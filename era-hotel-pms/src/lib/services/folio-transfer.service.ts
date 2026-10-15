import { decimalToNumber } from '@/lib/decimal';
import { prisma } from '@/lib/prisma';
import { recordHotelAudit } from '@/lib/satellite-audit';
import { ensureOpenFolio } from '@/lib/services/booking-folio.service';
import type { FolioType } from '@prisma/client';

async function ensureGuestFolio(reservationId: string, reservationGuestId: string) {
  const existing = await prisma.folio.findFirst({
    where: { reservationGuestId },
  });
  if (existing) {
    if (existing.status !== 'OPEN' || existing.reservationId !== reservationId) {
      throw new Error('Guest folio is closed');
    }
    return existing;
  }
  const { requestOrganizationId } = await import('@/lib/request-organization');
  return prisma.folio.create({
    data: {
      organizationId: requestOrganizationId(),
      reservationId,
      reservationGuestId,
      type: 'GUEST',
      status: 'OPEN',
    },
  });
}

export async function transferFolioCharge(input: {
  chargeId: string;
  note: string;
  targetFolioType?: FolioType;
  targetReservationId?: string;
  targetReservationGuestId?: string | null;
  actorUserId?: string;
}) {
  const note = input.note.trim();
  if (!note) throw new Error('TRANSFER_NOTE_REQUIRED');

  const charge = await prisma.folioCharge.findUnique({
    where: { id: input.chargeId },
    include: { folio: true, revenueCode: true },
  });
  if (!charge) throw new Error('Charge not found');
  if (charge.folio.status !== 'OPEN') throw new Error('Cannot transfer a charge on a closed folio');
  if (charge.serviceReceivedAt) throw new Error('Procedure already received — transfer refused');

  const targetReservationId = input.targetReservationId?.trim() || charge.folio.reservationId;
  const targetType = input.targetFolioType ?? charge.folio.type;
  if (targetReservationId === charge.folio.reservationId && targetType === charge.folio.type) {
    throw new Error('TRANSFER_SAME_FOLIO');
  }

  const targetStay = await prisma.reservation.findUnique({
    where: { id: targetReservationId },
    select: { id: true, status: true },
  });
  if (!targetStay) throw new Error('Target reservation not found');
  if (!['CONFIRMED', 'IN_HOUSE'].includes(targetStay.status)) {
    throw new Error('Target stay is not open');
  }

  const guestId = input.targetReservationGuestId?.trim() || '';
  const target =
    targetType === 'GUEST' && guestId
      ? await ensureGuestFolio(targetReservationId, guestId)
      : await ensureOpenFolio(targetReservationId, targetType);
  await prisma.folioCharge.update({
    where: { id: charge.id },
    data: { folioId: target.id },
  });

  const payload = {
    chargeId: charge.id,
    amount: decimalToNumber(charge.amount) * charge.qty,
    note,
    fromReservationId: charge.folio.reservationId,
    toReservationId: targetReservationId,
    fromFolioType: charge.folio.type,
    toFolioType: targetType,
    revenueCode: charge.revenueCode.code,
  };
  await recordHotelAudit(
    { userId: input.actorUserId },
    'Reservation',
    charge.folio.reservationId,
    'TRANSFER',
    payload,
  );
  if (targetReservationId !== charge.folio.reservationId) {
    await recordHotelAudit(
      { userId: input.actorUserId },
      'Reservation',
      targetReservationId,
      'TRANSFER',
      payload,
    );
  }
  return { folioId: target.id, reservationId: targetReservationId };
}
