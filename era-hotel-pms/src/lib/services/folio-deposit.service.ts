import { prisma } from '@/lib/prisma';
import { toDecimal, decimalToNumber } from '@/lib/decimal';
import type { PaymentMethod } from '@prisma/client';
import { folioBalance, postPayment } from '@/lib/services/folio.service';

export async function listDeposits(reservationId: string) {
  return prisma.folioDeposit.findMany({
    where: { reservationId },
    orderBy: { heldAt: 'desc' },
  });
}

export async function recordDeposit(input: {
  reservationId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  registerRef?: string;
  externalRef?: string;
}) {
  if (input.paymentMethod === 'DEPOSIT') {
    throw new Error('Cannot record a deposit with method DEPOSIT');
  }
  return prisma.folioDeposit.create({
    data: {
      reservationId: input.reservationId,
      amount: toDecimal(input.amount),
      paymentMethod: input.paymentMethod,
      registerRef: input.registerRef,
      externalRef: input.externalRef,
      status: 'HELD',
    },
  });
}

/** Apply HELD deposits to an OPEN folio (FIFO), up to maxAmount. */
export async function applyHeldDepositsToFolio(folioId: string, maxAmount?: number) {
  const folio = await prisma.folio.findUnique({
    where: { id: folioId },
    include: { charges: true, payments: true },
  });
  if (!folio) throw new Error('Folio not found');
  if (folio.status !== 'OPEN') throw new Error('Folio is not open');

  const held = await prisma.folioDeposit.findMany({
    where: { reservationId: folio.reservationId, status: 'HELD' },
    orderBy: { heldAt: 'asc' },
  });
  if (held.length === 0) return { applied: 0, amount: 0 };

  const balance = folioBalance(folio.charges, folio.payments);
  let remaining = maxAmount != null ? Math.min(maxAmount, Math.max(0, balance)) : Math.max(0, balance);
  if (remaining <= 0.01) return { applied: 0, amount: 0 };

  let applied = 0;
  let amount = 0;
  for (const dep of held) {
    if (remaining <= 0.01) break;
    const depAmt = decimalToNumber(dep.amount);
    const use = Math.min(depAmt, remaining);
    if (use <= 0.01) continue;

    await postPayment({
      folioId: folio.id,
      amount: use,
      paymentMethod: 'DEPOSIT',
      registerRef: dep.registerRef ?? `deposit:${dep.id}`,
    });
    await prisma.folioDeposit.update({
      where: { id: dep.id },
      data: { status: 'APPLIED', appliedAt: new Date(), folioId: folio.id },
    });
    applied += 1;
    amount += use;
    remaining -= use;
  }
  return { applied, amount };
}

export async function applyHeldDepositsOnCheckIn(reservationId: string) {
  const folio = await prisma.folio.findFirst({
    where: { reservationId, type: 'GUEST', status: 'OPEN' },
  });
  if (!folio) return { applied: 0, amount: 0 };
  return applyHeldDepositsToFolio(folio.id);
}

/** Apply all HELD deposits across open guest folio first, then company. */
export async function applyHeldDepositsToReservation(reservationId: string) {
  const guest = await prisma.folio.findFirst({
    where: { reservationId, type: 'GUEST', status: 'OPEN' },
  });
  if (guest) {
    const r = await applyHeldDepositsToFolio(guest.id);
    if (r.applied > 0) return r;
  }
  const company = await prisma.folio.findFirst({
    where: { reservationId, type: { in: ['COMPANY', 'AGENCY'] }, status: 'OPEN' },
  });
  if (company) return applyHeldDepositsToFolio(company.id);
  return { applied: 0, amount: 0 };
}

export async function refundRemainingDeposits(reservationId: string) {
  const applied = await prisma.folioDeposit.findMany({
    where: { reservationId, status: 'APPLIED' },
  });
  const refunded = await prisma.folioDeposit.updateMany({
    where: { reservationId, status: 'HELD' },
    data: { status: 'REFUNDED', refundedAt: new Date() },
  });
  return { appliedCount: applied.length, refundedHeld: refunded.count };
}
