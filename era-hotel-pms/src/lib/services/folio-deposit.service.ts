import { prisma } from '@/lib/prisma';
import { toDecimal, decimalToNumber } from '@/lib/decimal';
import type { PaymentMethod } from '@prisma/client';
import { postPayment } from '@/lib/services/folio.service';

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

export async function applyHeldDepositsOnCheckIn(reservationId: string) {
  const held = await prisma.folioDeposit.findMany({
    where: { reservationId, status: 'HELD' },
  });
  if (held.length === 0) return { applied: 0 };

  const folio = await prisma.folio.findFirst({
    where: { reservationId, type: 'GUEST', status: 'OPEN' },
  });
  if (!folio) return { applied: 0 };

  let applied = 0;
  for (const dep of held) {
    await postPayment({
      folioId: folio.id,
      amount: decimalToNumber(dep.amount),
      paymentMethod: dep.paymentMethod,
      registerRef: dep.registerRef ?? undefined,
    });
    await prisma.folioDeposit.update({
      where: { id: dep.id },
      data: { status: 'APPLIED', appliedAt: new Date(), folioId: folio.id },
    });
    applied += 1;
  }
  return { applied };
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
