import { decimalToNumber } from '@/lib/decimal';
import { prisma } from '@/lib/prisma';
import { ensureOpenFolio } from '@/lib/services/booking-folio.service';
import { allocatePaymentToCharges } from '@/lib/services/folio.service';
import type { FolioType } from '@prisma/client';

const OPEN_STAY = ['OPTION', 'CONFIRMED', 'IN_HOUSE'];

async function ensureGuestFolio(reservationId: string, reservationGuestId: string) {
  const guest = await prisma.reservationGuest.findFirst({
    where: { id: reservationGuestId, reservationId },
    select: { id: true },
  });
  if (!guest) throw new Error('Guest is not on this stay');
  const existing = await prisma.folio.findFirst({
    where: { reservationGuestId, reservationId, type: 'GUEST' },
  });
  if (existing) {
    if (existing.status !== 'OPEN') throw new Error('Guest folio is closed');
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

async function resolveTransferFolio(input: {
  reservationId: string;
  folioType: FolioType;
  reservationGuestId?: string | null;
  sourceFolioId: string;
}) {
  const stay = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    select: { status: true, companyId: true, agencyId: true },
  });
  if (!stay) throw new Error('Target reservation not found');
  if (!OPEN_STAY.includes(stay.status)) throw new Error('Target stay is not open');
  if (input.folioType === 'COMPANY' && !stay.companyId) throw new Error('NO_COMPANY_ON_STAY');
  if (input.folioType === 'AGENCY' && !stay.agencyId) throw new Error('NO_AGENCY_ON_STAY');
  const guestId = input.reservationGuestId?.trim() || '';
  const target =
    input.folioType === 'GUEST' && guestId
      ? await ensureGuestFolio(input.reservationId, guestId)
      : await ensureOpenFolio(input.reservationId, input.folioType);
  if (target.id === input.sourceFolioId) throw new Error('TRANSFER_SAME_FOLIO');
  if (target.status !== 'OPEN') throw new Error('Guest folio is closed');
  return target;
}

export async function transferFolioCharge(input: {
  chargeId: string;
  note: string;
  targetFolioType?: FolioType;
  targetReservationId?: string;
  targetReservationGuestId?: string | null;
  actorUserId?: string;
  request?: Request;
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
  const target = await resolveTransferFolio({
    reservationId: targetReservationId,
    folioType: targetType,
    reservationGuestId: input.targetReservationGuestId,
    sourceFolioId: charge.folioId,
  });
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
  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  const fields = [
    { key: 'amount', from: String(payload.amount), to: null },
    { key: 'revenueCode', from: payload.revenueCode, to: payload.revenueCode },
    { key: 'folioType', from: payload.fromFolioType, to: payload.toFolioType },
  ];
  const actor = { userId: input.actorUserId, request: input.request };
  await recordReservationAudit(charge.folio.reservationId, 'TRANSFER', actor, {
    section: 'folio',
    source: 'user',
    fields,
    refs: { chargeId: charge.id, toReservationId: targetReservationId },
  });
  if (targetReservationId !== charge.folio.reservationId) {
    await recordReservationAudit(targetReservationId, 'TRANSFER', actor, {
      section: 'folio',
      source: 'user',
      fields: fields.map((row) => ({ ...row, from: null, to: row.to })),
      refs: { chargeId: charge.id, fromReservationId: charge.folio.reservationId },
    });
  }
  return { folioId: target.id, reservationId: targetReservationId };
}

export async function transferFolioPayment(input: {
  paymentId: string;
  note: string;
  targetFolioType?: FolioType;
  targetReservationId?: string;
  targetReservationGuestId?: string | null;
  actorUserId?: string;
  request?: Request;
}) {
  const note = input.note.trim();
  if (!note) throw new Error('TRANSFER_NOTE_REQUIRED');
  const payment = await prisma.folioPayment.findUnique({
    where: { id: input.paymentId },
    include: { folio: true, revenueCode: true },
  });
  if (!payment) throw new Error('Payment not found');
  if (payment.voidedAt) throw new Error('Payment is already deleted');
  if (payment.folio.status !== 'OPEN') throw new Error('Cannot transfer a charge on a closed folio');
  const targetReservationId = input.targetReservationId?.trim() || payment.folio.reservationId;
  const targetType = input.targetFolioType ?? payment.folio.type;
  const target = await resolveTransferFolio({
    reservationId: targetReservationId,
    folioType: targetType,
    reservationGuestId: input.targetReservationGuestId,
    sourceFolioId: payment.folioId,
  });
  await prisma.folioPaymentAllocation.deleteMany({ where: { paymentId: payment.id } });
  await prisma.folioPayment.update({
    where: { id: payment.id },
    data: { folioId: target.id },
  });
  if (payment.kind === 'PAYMENT') {
    await allocatePaymentToCharges(
      target.id,
      payment.id,
      decimalToNumber(payment.amount),
      payment.revenueCodeId ?? undefined,
    );
  }
  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  const actor = { userId: input.actorUserId, request: input.request };
  await recordReservationAudit(payment.folio.reservationId, 'TRANSFER', actor, {
    section: 'folio',
    source: 'user',
    fields: [
      { key: 'amount', from: String(decimalToNumber(payment.amount)), to: null },
      { key: 'note', from: null, to: note },
      { key: 'folioType', from: payment.folio.type, to: targetType },
    ],
    refs: { paymentId: payment.id, toReservationId: targetReservationId },
  });
  return { folioId: target.id, reservationId: targetReservationId };
}
