import { prisma } from '@/lib/prisma';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { decimalToNumber } from '@/lib/decimal';
import type { ReservationAuditActor } from '@/lib/reservation-audit';

/** Other open stays of the same guest, for carry and cashier transfer. */
export async function listDepositTargets(reservationId: string) {
  const stay = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { guestId: true },
  });
  if (!stay) return [];
  const rows = await prisma.reservation.findMany({
    where: {
      id: { not: reservationId },
      guestId: stay.guestId,
      status: { in: ['OPTION', 'CONFIRMED', 'IN_HOUSE'] },
    },
    select: {
      id: true,
      status: true,
      checkInDate: true,
      checkOutDate: true,
      room: { select: { roomNumber: true } },
      paxGuests: {
        select: { id: true, firstName: true, lastName: true, isPrimary: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { checkInDate: 'asc' },
    take: 20,
  });
  return rows.map((row) => ({
    reservationId: row.id,
    status: row.status,
    roomNumber: row.room?.roomNumber ?? '',
    checkIn: hotelDateKey(row.checkInDate),
    checkOut: hotelDateKey(row.checkOutDate),
    guests: row.paxGuests.map((guest) => ({
      id: guest.id,
      name: [guest.firstName, guest.lastName].filter(Boolean).join(' '),
      isPrimary: guest.isPrimary,
    })),
  }));
}

export async function listDeposits(reservationId: string) {
  return prisma.folioDeposit.findMany({
    where: { reservationId },
    orderBy: { heldAt: 'desc' },
  });
}

export async function getFolioReservationId(folioId: string) {
  const folio = await prisma.folio.findUnique({
    where: { id: folioId },
    select: { reservationId: true },
  });
  return folio?.reservationId ?? null;
}

const OPEN_FOR_DEPOSIT = ['OPTION', 'CONFIRMED', 'IN_HOUSE'] as const;

/**
 * Advance on this reservation, not revenue and not a guest wallet.
 * Room may be empty. Dates are already required on the stay.
 */
export async function recordDeposit(input: {
  reservationId: string;
  reservationGuestId: string;
  amount: number;
  paymentMethod: string;
  registerRef?: string;
  bankTerminalId?: string;
  externalRef?: string;
  audit?: { userId?: string | null; request?: Request };
}) {
  if (!(input.amount > 0)) throw new Error('Amount must be positive');
  if (input.paymentMethod !== 'CASH' && input.paymentMethod !== 'CARD' && input.paymentMethod !== 'DEPOSIT') {
    throw new Error('Deposit accepts CASH or CARD');
  }
  const stay = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    select: { id: true, status: true, organizationId: true },
  });
  if (!stay || !OPEN_FOR_DEPOSIT.includes(stay.status as (typeof OPEN_FOR_DEPOSIT)[number])) {
    throw Object.assign(new Error('Deposit is only for an open future or in-house stay'), {
      status: 409,
      code: 'DEPOSIT_STAY_CLOSED',
    });
  }
  const guest = await prisma.reservationGuest.findFirst({
    where: { id: input.reservationGuestId, reservationId: input.reservationId },
  });
  if (!guest) {
    throw Object.assign(new Error('Deposit guest is not on this stay'), {
      status: 409,
      code: 'DEPOSIT_GUEST_REQUIRED',
    });
  }
  if (input.paymentMethod === 'CARD') {
    const { requestOrganizationId } = await import('@/lib/request-organization');
    const { listDevicesForSatellite } = await import('@era/satellite-kit');
    const terminals = listDevicesForSatellite({
      organizationId: requestOrganizationId(),
      kind: 'BANK_POS',
    });
    if (terminals.length > 0 && !input.bankTerminalId?.trim()) {
      throw Object.assign(new Error('BANK_TERMINAL_REQUIRED'), { status: 409, code: 'BANK_TERMINAL_REQUIRED' });
    }
  }
  const { getCurrentBusinessDate } = await import('@/lib/services/business-date.service');
  const businessDate = await getCurrentBusinessDate();
  let fiscalReceiptId: string | null = null;
  if (input.paymentMethod === 'CASH' || input.paymentMethod === 'CARD') {
    const { requestOrganizationId } = await import('@/lib/request-organization');
    const orgId = requestOrganizationId();
    const { fiscalizeForSatellite, isFiscalSkipped } = await import('@era/satellite-kit');
    try {
      const { ensureOpenCashShift } = await import('@/lib/services/cash-shift.service');
      const cashShift = await ensureOpenCashShift({
        registerId: input.registerRef?.trim() || undefined,
      });
      const receipt = await fiscalizeForSatellite(
        {
          documentRef: input.reservationId,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          registerRef: input.registerRef ?? cashShift.registerId,
          organizationId: orgId,
          fiscalDeviceId: cashShift.fiscalDeviceId ?? undefined,
          bankTerminalId: input.bankTerminalId?.trim() || cashShift.bankTerminalId || undefined,
          shiftFiscalDeviceId: cashShift.fiscalDeviceId ?? undefined,
          shiftBankTerminalId: cashShift.bankTerminalId ?? undefined,
          lines: [{ name: 'Deposit', qty: 1, unitPrice: input.amount }],
        },
        orgId,
      );
      if (!isFiscalSkipped(receipt)) fiscalReceiptId = receipt.receiptId;
    } catch (e) {
      console.error('Deposit fiscalize failed', e);
      if (process.env.ERA_FISCAL_LIVE === 'true' || (e instanceof Error && e.name === 'FiscalError')) throw e;
    }
  }
  const row = await prisma.folioDeposit.create({
    data: {
      organizationId: stay.organizationId,
      reservationId: input.reservationId,
      reservationGuestId: guest.id,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      registerRef: input.registerRef ?? null,
      externalRef: input.externalRef ?? null,
      fiscalReceiptId,
      businessDate,
      status: 'HELD',
    },
  });
  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  await recordReservationAudit(input.reservationId, 'DEPOSIT_RECORDED', input.audit, {
    section: 'folio',
    source: 'user',
    summary: `Deposit ${input.amount.toFixed(2)} ${input.paymentMethod}`,
    fields: [{ key: 'deposit', from: null, to: input.amount.toFixed(2) }],
  });
  return row;
}

/** Cashier move of a HELD deposit onto another stay and guest. Not a new receipt. */
export async function transferDeposit(input: {
  depositId: string;
  targetReservationId: string;
  targetReservationGuestId: string;
  audit?: { userId?: string | null; request?: Request };
}) {
  const row = await prisma.folioDeposit.findUnique({ where: { id: input.depositId } });
  if (!row || row.status !== 'HELD') {
    throw Object.assign(new Error('Only a held deposit can be transferred'), {
      status: 409,
      code: 'DEPOSIT_NOT_HELD',
    });
  }
  const targetGuest = await prisma.reservationGuest.findFirst({
    where: { id: input.targetReservationGuestId, reservationId: input.targetReservationId },
  });
  if (!targetGuest) {
    throw Object.assign(new Error('Target guest is not on the target stay'), {
      status: 409,
      code: 'DEPOSIT_TARGET_REQUIRED',
    });
  }
  const fromReservationId = row.reservationId;
  const updated = await prisma.folioDeposit.update({
    where: { id: row.id },
    data: {
      reservationId: input.targetReservationId,
      reservationGuestId: targetGuest.id,
      folioId: null,
      externalRef: `TRANSFER_FROM:${fromReservationId}`,
    },
  });
  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  const summary = `Deposit ${decimalToNumber(row.amount).toFixed(2)} moved`;
  await recordReservationAudit(fromReservationId, 'DEPOSIT_TRANSFER', input.audit, {
    section: 'folio',
    source: 'user',
    summary,
    fields: [{ key: 'deposit', from: fromReservationId, to: input.targetReservationId }],
  });
  await recordReservationAudit(input.targetReservationId, 'DEPOSIT_TRANSFER', input.audit, {
    section: 'folio',
    source: 'user',
    summary,
    fields: [{ key: 'deposit', from: fromReservationId, to: input.targetReservationId }],
  });
  return updated;
}

/**
 * Checkout surplus leaves this stay at zero and becomes HELD on another stay.
 * The offset uses payment method DEPOSIT so it is not a cash refund.
 */
export async function carryUnusedCreditToStay(input: {
  sourceReservationId: string;
  targetReservationId?: string;
  newCheckIn?: string;
  newCheckOut?: string;
  audit?: { userId?: string | null; request?: Request };
}) {
  const { folioBalance, postPayment } = await import('@/lib/services/folio.service');
  const folios = await prisma.folio.findMany({
    where: { reservationId: input.sourceReservationId, status: 'OPEN', type: 'GUEST' },
    include: { charges: true, payments: true },
  });
  let unused = 0;
  for (const folio of folios) {
    const balance = folioBalance(folio.charges, folio.payments);
    if (balance < -0.009) unused += -balance;
  }
  if (unused <= 0.009) return { carried: 0, targetReservationId: input.targetReservationId ?? null };

  let targetReservationId = input.targetReservationId ?? null;
  if (!targetReservationId) {
    if (!input.newCheckIn || !input.newCheckOut) {
      throw Object.assign(new Error('Pick a future stay or its dates'), {
        status: 409,
        code: 'CARRY_TARGET_REQUIRED',
      });
    }
    const { getReservation, createReservation } = await import('@/lib/services/reservation.service');
    const source = await getReservation(input.sourceReservationId);
    const created = await createReservation({
      guestId: source.guestId,
      roomTypeId: source.roomTypeId,
      ratePlanId: source.ratePlanId,
      checkInDate: new Date(input.newCheckIn),
      checkOutDate: new Date(input.newCheckOut),
      adults: 1,
      status: 'CONFIRMED',
      copyGuestNameToPax: true,
      audit: input.audit,
    });
    targetReservationId = created.id;
  }
  if (!targetReservationId) {
    throw Object.assign(new Error('Future stay was not created'), {
      status: 409,
      code: 'CARRY_TARGET_REQUIRED',
    });
  }
  const target = await prisma.reservation.findUnique({
    where: { id: targetReservationId },
    include: { paxGuests: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!target || !OPEN_FOR_DEPOSIT.includes(target.status as (typeof OPEN_FOR_DEPOSIT)[number])) {
    throw Object.assign(new Error('Future stay is not open for a deposit'), {
      status: 409,
      code: 'CARRY_TARGET_REQUIRED',
    });
  }
  const payer = target.paxGuests.find((row) => row.isPrimary) ?? target.paxGuests[0];
  if (!payer) {
    throw Object.assign(new Error('Future stay has no guest'), {
      status: 409,
      code: 'DEPOSIT_GUEST_REQUIRED',
    });
  }
  await recordDeposit({
    reservationId: target.id,
    reservationGuestId: payer.id,
    amount: Math.round(unused * 100) / 100,
    paymentMethod: 'DEPOSIT',
    externalRef: `TRANSFER_FROM:${input.sourceReservationId}`,
    audit: input.audit,
  });
  for (const folio of folios) {
    const balance = folioBalance(folio.charges, folio.payments);
    if (balance >= -0.009) continue;
    await postPayment({
      folioId: folio.id,
      amount: Math.round(-balance * 100) / 100,
      paymentMethod: 'DEPOSIT',
      kind: 'REFUND',
      refundReason: 'Unused credit carried to a future stay',
      createdByUserId: input.audit?.userId ?? undefined,
      auditRequest: input.audit?.request,
    });
  }
  return { carried: unused, targetReservationId: target.id };
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
  paymentMethod: string,
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
