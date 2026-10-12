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
    const leftover = Math.round((depAmt - use) * 100) / 100;
    await prisma.folioDeposit.update({
      where: { id: dep.id },
      data: {
        amount: toDecimal(use),
        status: 'APPLIED',
        appliedAt: new Date(),
        folioId: folio.id,
      },
    });
    if (leftover > 0.01) {
      await prisma.folioDeposit.create({
        data: {
          reservationId: folio.reservationId,
          amount: toDecimal(leftover),
          paymentMethod: dep.paymentMethod,
          registerRef: dep.registerRef,
          status: 'HELD',
        },
      });
    }
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

/** Held remainder stays HELD until the cashier pays it out or carries it. */
export async function refundRemainingDeposits(reservationId: string) {
  const applied = await prisma.folioDeposit.findMany({
    where: { reservationId, status: 'APPLIED' },
  });
  const held = await prisma.folioDeposit.findMany({
    where: { reservationId, status: 'HELD' },
  });
  const heldAmount = held.reduce((sum, row) => sum + decimalToNumber(row.amount), 0);
  return { appliedCount: applied.length, refundedHeld: 0, heldAmount, heldIds: held.map((row) => row.id) };
}

export async function payoutDepositRemainder(
  depositId: string,
  paymentMethod: PaymentMethod,
  bankTerminalId?: string,
) {
  if (paymentMethod !== 'CASH' && paymentMethod !== 'CARD') {
    throw new Error('Payout is cash or card');
  }
  const dep = await prisma.folioDeposit.findUnique({ where: { id: depositId } });
  if (!dep || dep.status !== 'HELD') throw new Error('Deposit is not held');
  const amount = decimalToNumber(dep.amount);
  const { requestOrganizationId } = await import('@/lib/request-organization');
  const { fiscalizeForSatellite, isFiscalSkipped } = await import('@era/satellite-kit');
  const orgId = requestOrganizationId();
  const cashShift = await prisma.cashShift.findFirst({
    where: { status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
  });
  const terminal = paymentMethod === 'CARD' ? bankTerminalId?.trim() || cashShift?.bankTerminalId || undefined : undefined;
  const receipt = await fiscalizeForSatellite(
    {
      documentRef: depositId,
      amount,
      paymentMethod,
      organizationId: orgId,
      fiscalDeviceId: cashShift?.fiscalDeviceId ?? undefined,
      bankTerminalId: terminal,
      shiftFiscalDeviceId: cashShift?.fiscalDeviceId ?? undefined,
      shiftBankTerminalId: cashShift?.bankTerminalId ?? undefined,
      lines: [{ name: 'Deposit payout', qty: 1, unitPrice: amount }],
    },
    orgId,
  );
  const fiscalReceiptId = isFiscalSkipped(receipt) ? null : receipt.receiptId;
  return prisma.folioDeposit.update({
    where: { id: depositId },
    data: {
      status: 'REFUNDED',
      refundedAt: new Date(),
      paymentMethod,
      payoutBankTerminalId: terminal ?? null,
      fiscalReceiptId,
    },
  });
}

/** Liability stays with the guest. Cash does not move. Night audit posts the transfer. */
export async function carryDepositRemainder(depositId: string) {
  const dep = await prisma.folioDeposit.findUnique({ where: { id: depositId } });
  if (!dep || dep.status !== 'HELD') throw new Error('Deposit is not held');
  return prisma.folioDeposit.update({
    where: { id: depositId },
    data: { status: 'CARRIED', appliedAt: new Date() },
  });
}
