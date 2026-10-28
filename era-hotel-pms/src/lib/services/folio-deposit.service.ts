import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import type { PaymentMethod } from '@prisma/client';
import type { ReservationAuditActor } from '@/lib/reservation-audit';

export async function listDeposits(reservationId: string) {
  return prisma.folioDeposit.findMany({
    where: { reservationId },
    orderBy: { heldAt: 'desc' },
  });
}

export async function recordDeposit(_input: {
  reservationId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  registerRef?: string;
  externalRef?: string;
  audit?: { userId?: string | null; request?: Request };
}): Promise<never> {
  throw new Error('DEPOSIT_INTAKE_CLOSED');
}

/** Old HELD rows become one blue room payment. This does not take new money. */
export async function applyHeldDepositsToFolio(
  folioId: string,
  _maxAmount?: number,
  _audit?: ReservationAuditActor,
) {
  const folio = await prisma.folio.findUnique({
    where: { id: folioId },
    select: { reservationId: true },
  });
  if (!folio) throw new Error('Folio not found');
  const held = await prisma.folioDeposit.findMany({
    where: { reservationId: folio.reservationId, status: 'HELD' },
  });
  const moved = await moveHeldDepositsOntoFolio(folio.reservationId);
  const amount = held.reduce((sum, row) => sum + decimalToNumber(row.amount), 0);
  return { applied: moved, amount: moved > 0 ? amount : 0 };
}

export async function applyHeldDepositsOnCheckIn(
  reservationId: string,
  audit?: ReservationAuditActor,
) {
  const folio = await prisma.folio.findFirst({
    where: { reservationId, type: 'GUEST', status: 'OPEN' },
  });
  if (!folio) return { applied: 0, amount: 0 };
  return applyHeldDepositsToFolio(folio.id, undefined, audit);
}

/** Apply all HELD deposits across open guest folio first, then company. */
export async function applyHeldDepositsToReservation(
  reservationId: string,
  audit?: ReservationAuditActor,
) {
  const guest = await prisma.folio.findFirst({
    where: { reservationId, type: 'GUEST', status: 'OPEN' },
  });
  if (guest) {
    const r = await applyHeldDepositsToFolio(guest.id, undefined, audit);
    if (r.applied > 0) return r;
  }
  const company = await prisma.folio.findFirst({
    where: { reservationId, type: { in: ['COMPANY', 'AGENCY'] }, status: 'OPEN' },
  });
  if (company) return applyHeldDepositsToFolio(company.id, undefined, audit);
  return { applied: 0, amount: 0 };
}

/**
 * Old HELD rows have no folio line and only fed the header sum.
 * Move each one onto a blue payment of the room article once. New money is not written here.
 */
export async function moveHeldDepositsOntoFolio(reservationId: string): Promise<number> {
  const held = await prisma.folioDeposit.findMany({
    where: { reservationId, status: 'HELD' },
    orderBy: { heldAt: 'asc' },
  });
  if (held.length === 0) return 0;
  const room = await prisma.revenueCode.findFirst({
    where: { active: true, systemRole: 'ROOM' },
    orderBy: { code: 'asc' },
  });
  const { resolveChargeFolio } = await import('@/lib/services/booking-folio.service');
  const folio = room
    ? await resolveChargeFolio({ reservationId, revenueCodeId: room.id })
    : await prisma.folio.findFirst({
        where: { reservationId, type: 'GUEST', status: 'OPEN' },
      });
  if (!folio) return 0;
  const { allocatePaymentToCharges } = await import('@/lib/services/folio.service');
  let moved = 0;
  for (const dep of held) {
    const payment = await prisma.folioPayment.create({
      data: {
        organizationId: dep.organizationId,
        folioId: folio.id,
        amount: dep.amount,
        paymentMethod: dep.paymentMethod,
        kind: 'PAYMENT',
        revenueCodeId: room?.id ?? null,
        businessDate: dep.businessDate,
        registerRef: `moved-from-held:${dep.id}`,
      },
    });
    if (room) {
      await allocatePaymentToCharges(folio.id, payment.id, decimalToNumber(dep.amount), room.id);
    }
    await prisma.folioDeposit.update({
      where: { id: dep.id },
      data: { status: 'APPLIED', folioId: folio.id, appliedAt: new Date() },
    });
    moved += 1;
  }
  return moved;
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
  audit?: ReservationAuditActor,
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
  const { ensureOpenCashShift } = await import('@/lib/services/cash-shift.service');
  const cashShift = await ensureOpenCashShift();
  if (paymentMethod === 'CARD') {
    const { ensureFiscalDevices } = await import('@/lib/fiscal-device-mirror');
    await ensureFiscalDevices(orgId);
    const { listDevicesForSatellite } = await import('@era/satellite-kit');
    const terminals = listDevicesForSatellite({ organizationId: orgId, kind: 'BANK_POS' });
    if (terminals.length > 0 && !bankTerminalId?.trim()) throw new Error('BANK_TERMINAL_REQUIRED');
  }
  const terminal = paymentMethod === 'CARD' ? bankTerminalId?.trim() || undefined : undefined;
  const receipt = await fiscalizeForSatellite(
    {
      documentRef: depositId,
      amount,
      paymentMethod,
      organizationId: orgId,
      registerRef: cashShift.registerId,
      fiscalDeviceId: cashShift.fiscalDeviceId ?? undefined,
      bankTerminalId: terminal || cashShift.bankTerminalId || undefined,
      shiftFiscalDeviceId: cashShift.fiscalDeviceId ?? undefined,
      shiftBankTerminalId: cashShift.bankTerminalId ?? undefined,
      lines: [{ name: 'Deposit payout', qty: 1, unitPrice: amount }],
    },
    orgId,
  );
  const fiscalReceiptId = isFiscalSkipped(receipt) ? null : receipt.receiptId;
  const updated = await prisma.folioDeposit.update({
    where: { id: depositId },
    data: {
      status: 'REFUNDED',
      refundedAt: new Date(),
      paymentMethod,
      payoutBankTerminalId: terminal ?? null,
      fiscalReceiptId,
    },
  });
  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  await recordReservationAudit(dep.reservationId, 'DEPOSIT_PAYOUT', audit, {
    section: 'folio',
    source: 'user',
    fields: [
      { key: 'amount', from: null, to: String(amount) },
      { key: 'paymentMethod', from: null, to: paymentMethod },
    ],
    refs: { depositId },
  });
  return updated;
}

/** Liability stays with the guest. Cash does not move. Night audit posts the transfer. */
export async function carryDepositRemainder(
  depositId: string,
  audit?: ReservationAuditActor,
) {
  const dep = await prisma.folioDeposit.findUnique({ where: { id: depositId } });
  if (!dep || dep.status !== 'HELD') throw new Error('Deposit is not held');
  const updated = await prisma.folioDeposit.update({
    where: { id: depositId },
    data: { status: 'CARRIED', appliedAt: new Date() },
  });
  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  await recordReservationAudit(dep.reservationId, 'DEPOSIT_CARRY', audit, {
    section: 'folio',
    source: 'user',
    fields: [
      { key: 'amount', from: null, to: String(decimalToNumber(dep.amount)) },
      { key: 'status', from: 'HELD', to: 'CARRIED' },
    ],
    refs: { depositId },
  });
  return updated;
}
