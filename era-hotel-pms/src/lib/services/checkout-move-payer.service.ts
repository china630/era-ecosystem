import { prisma } from '@/lib/prisma';
import {
  transferFolioCharge,
  transferFolioPayment,
} from '@/lib/services/folio-transfer.service';

/**
 * Move every open guest-folio charge and payment on the stay onto the company
 * (preferred) or agency folio so check-out can hand the balance to City Ledger.
 */
export async function transferOpenGuestChargesToPayer(input: {
  reservationId: string;
  note?: string;
  actorUserId?: string;
  request?: Request;
}): Promise<{
  payerType: 'COMPANY' | 'AGENCY';
  transferredCharges: number;
  transferredPayments: number;
}> {
  const stay = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    select: { companyId: true, agencyId: true },
  });
  if (!stay) {
    throw Object.assign(new Error('Reservation not found'), { status: 404, code: 'NOT_FOUND' });
  }
  const payerType: 'COMPANY' | 'AGENCY' | null = stay.companyId
    ? 'COMPANY'
    : stay.agencyId
      ? 'AGENCY'
      : null;
  if (!payerType) {
    throw Object.assign(new Error('Stay has no company or agency to receive guest debt'), {
      status: 409,
      code: 'NO_PAYER_ON_STAY',
    });
  }

  const note =
    input.note?.trim() ||
    `Check-out: move guest folio balance to ${payerType} for City Ledger`;

  const guestFolios = await prisma.folio.findMany({
    where: { reservationId: input.reservationId, status: 'OPEN', type: 'GUEST' },
    include: {
      charges: { select: { id: true, serviceReceivedAt: true } },
      payments: { select: { id: true, voidedAt: true } },
    },
  });

  let transferredCharges = 0;
  let transferredPayments = 0;
  const actor = { actorUserId: input.actorUserId, request: input.request };

  try {
    for (const folio of guestFolios) {
      for (const charge of folio.charges) {
        if (charge.serviceReceivedAt) continue;
        await transferFolioCharge({
          chargeId: charge.id,
          note,
          targetFolioType: payerType,
          targetReservationId: input.reservationId,
          ...actor,
        });
        transferredCharges += 1;
      }
      for (const payment of folio.payments) {
        if (payment.voidedAt) continue;
        await transferFolioPayment({
          paymentId: payment.id,
          note,
          targetFolioType: payerType,
          targetReservationId: input.reservationId,
          ...actor,
        });
        transferredPayments += 1;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'MOVE_PAYER_FAILED';
    throw Object.assign(new Error(message), {
      status: 409,
      code: 'MOVE_PAYER_FAILED',
      cause: err,
    });
  }

  return { payerType, transferredCharges, transferredPayments };
}
