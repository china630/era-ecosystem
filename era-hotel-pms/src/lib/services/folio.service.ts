import { shouldOffsetHouseUse } from '@/lib/stay-billing';
import { prisma } from '@/lib/prisma';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';
import { requestOrganizationId } from '@/lib/request-organization';
import { assertActiveForNewUse } from '@/lib/master-data/retire-policy';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { requireRevenueCodeByRole } from '@/lib/revenue-code-token';
import type { FolioType, PaymentMethod } from '@prisma/client';
import {
  dispatchFolioChargePosted,
  dispatchFolioChargeVoided,
  dispatchFolioPaymentReceived,
} from '@/lib/integration/event-dispatcher';
import { parseRoomChargeNote, roomChargeNote } from '@/lib/folio-charge-note';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { stayMoneyPair } from '@/lib/folio-money-pair';

function chargeDescriptionForPost(
  systemRole: string | null,
  description: string,
  businessDate: Date,
): string {
  const trimmed = description.trim();
  if (systemRole !== 'ROOM') return trimmed;
  if (trimmed.includes('(early CO remaining)')) return trimmed;
  if (parseRoomChargeNote(trimmed)) return trimmed;
  return roomChargeNote('manual-room', hotelDateKey(businessDate));
}

function fireAndForgetDispatch(promise: Promise<unknown>) {
  promise.catch((err) => console.error('Outbound dispatch failed', err));
}

export function folioBalance(
  charges: { amount: { toNumber(): number }; qty: number }[],
  payments: { amount: { toNumber(): number }; kind?: string | null; voidedAt?: Date | null }[],
) {
  const chargeSum = charges.reduce((s, c) => s + decimalToNumber(c.amount) * c.qty, 0);
  const paySum = payments.reduce((s, p) => {
    if (p.voidedAt) return s;
    const n = decimalToNumber(p.amount);
    return s + (p.kind === 'REFUND' ? -n : n);
  }, 0);
  return chargeSum - paySum;
}

/** Guest folios only. Company and agency folios open when a charge or payment is routed there. */
export async function openFoliosForReservation(reservationId: string) {
  const existing = await prisma.folio.findMany({ where: { reservationId } });
  if (existing.length > 0) return existing;

  const { ensurePartyGuestFolios } = await import('@/lib/services/booking-folio.service');
  const personal = await ensurePartyGuestFolios(reservationId);
  if (personal.length > 0) return personal;

  return [
    await prisma.folio.create({
      data: {
        organizationId: requestOrganizationId(),
        reservationId,
        type: 'GUEST',
        status: 'OPEN',
      },
    }),
  ];
}

export async function resolveTargetFolioType(
  revenueCodeId: string,
  defaultType: FolioType = 'GUEST',
  reservationId?: string,
): Promise<FolioType> {
  if (reservationId) {
    const override = await prisma.reservationFolioRoutingOverride.findUnique({
      where: {
        reservationId_revenueCodeId: { reservationId, revenueCodeId },
      },
    });
    if (override) return override.targetFolioType;
  }
  const rule = await prisma.folioRoutingRule.findUnique({ where: { revenueCodeId } });
  return rule?.targetFolioType ?? defaultType;
}

export async function postCharge(input: {
  reservationId: string;
  revenueCodeId: string;
  amount: number;
  qty?: number;
  /** Quantity that moves stock. Defaults to qty. Money-only lines pass 0. */
  stockQty?: number;
  warehouseCode?: string | null;
  sku?: string | null;
  description: string;
  businessDate?: Date;
  departmentId?: string;
  folioType?: 'GUEST' | 'AGENCY' | 'COMPANY';
  /** Guest who received an extra. Room and tax ignore this and use the room payer. */
  reservationGuestId?: string | null;
  externalRef?: string;
  invoiceRef?: string;
  audit?: { userId?: string | null; request?: Request; source?: 'user' | 'elektraweb' | 'night_audit' | 'system' };
}) {
  const { assertBusinessDayOpenForPosting } = await import('@/lib/services/business-date.service');
  await assertBusinessDayOpenForPosting();

  const reservation = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    include: { folios: true, guest: true },
  });
  if (!reservation) throw new Error('Reservation not found');
  if (!['OPTION', 'CONFIRMED', 'IN_HOUSE'].includes(reservation.status)) {
    throw new Error('Charges can only be posted to OPTION, CONFIRMED or IN_HOUSE reservations');
  }

  const revenueCode = await prisma.revenueCode.findUnique({ where: { id: input.revenueCodeId } });
  if (!revenueCode) throw new Error('Revenue code not found');
  assertActiveForNewUse(`Revenue code ${revenueCode.code}`, revenueCode.active);

  const { resolveChargeFolio } = await import('@/lib/services/booking-folio.service');
  const chargeReservationId = input.reservationId;
  const folio = await resolveChargeFolio({
    reservationId: input.reservationId,
    revenueCodeId: input.revenueCodeId,
    explicit: input.folioType ?? null,
    reservationGuestId: input.reservationGuestId ?? null,
  });

  const businessDate = input.businessDate ?? (await getCurrentBusinessDate());
  const { assertYearBoundaryAllows } = await import('@/lib/services/year-boundary.service');
  await assertYearBoundaryAllows(businessDate);
  const description = chargeDescriptionForPost(revenueCode.systemRole, input.description, businessDate);

  const charge = await prisma.folioCharge.create({
    data: {
      folioId: folio.id,
      revenueCodeId: input.revenueCodeId,
      departmentId: input.departmentId,
      amount: toDecimal(input.amount),
      qty: input.qty ?? 1,
      stockQty: input.stockQty ?? input.qty ?? 1,
      warehouseCode: input.warehouseCode?.trim() || null,
      sku: input.sku?.trim() || null,
      description,
      businessDate,
      externalRef: input.externalRef,
      invoiceRef: input.invoiceRef,
    },
    include: { revenueCode: true, folio: true },
  });
  await allocateArticleCreditsToCharge(folio.id, charge.id, input.revenueCodeId);

  await recalcReservationTotal(chargeReservationId);
  if (chargeReservationId !== input.reservationId) {
    await recalcReservationTotal(input.reservationId);
  }
  if (
    shouldOffsetHouseUse({
      billingMode: reservation.billingMode,
      amount: input.amount,
      externalRef: input.externalRef,
    })
  ) {
    const offset = await prisma.folioCharge.create({
      data: {
        folioId: folio.id,
        revenueCodeId: input.revenueCodeId,
        departmentId: input.departmentId,
        amount: toDecimal(-input.amount),
        qty: input.qty ?? 1,
        stockQty: 0,
        sku: input.sku?.trim() || null,
        description: `${description} (house use)`,
        businessDate,
        externalRef: `house-use:${charge.id}`,
      },
    });
    fireAndForgetDispatch(dispatchFolioChargePosted(offset.id));
  }
  fireAndForgetDispatch(dispatchFolioChargePosted(charge.id));
  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  await recordReservationAudit(chargeReservationId, 'CHARGE', input.audit, {
    section: 'folio',
    source: input.audit?.source ?? 'user',
    fields: [
      { key: 'amount', from: null, to: String(input.amount) },
      { key: 'revenueCode', from: null, to: revenueCode.code },
      { key: 'description', from: null, to: description },
    ],
    refs: { chargeId: charge.id, folioId: folio.id },
  });
  return charge;
}

export async function allocatePaymentToCharges(
  folioId: string,
  paymentId: string,
  amount: number,
  revenueCodeId?: string,
) {
  const charges = await prisma.folioCharge.findMany({
    where: {
      folioId,
      ...(revenueCodeId ? { revenueCodeId } : {}),
    },
    orderBy: [{ businessDate: 'asc' }, { id: 'asc' }],
    include: { paymentAllocations: true },
  });
  let left = amount;
  for (const charge of charges) {
    if (left <= 0.009) break;
    const gross = decimalToNumber(charge.amount) * charge.qty;
    if (gross <= 0.009) continue;
    const already = charge.paymentAllocations.reduce((sum, row) => sum + decimalToNumber(row.amount), 0);
    const open = gross - already;
    if (open <= 0.009) continue;
    const take = Math.min(open, left);
    await prisma.folioPaymentAllocation.create({
      data: {
        paymentId,
        chargeId: charge.id,
        amount: toDecimal(Math.round(take * 100) / 100),
      },
    });
    left -= take;
  }
}

async function allocateArticleCreditsToCharge(folioId: string, chargeId: string, revenueCodeId: string) {
  const charge = await prisma.folioCharge.findUnique({
    where: { id: chargeId },
    include: { paymentAllocations: true },
  });
  if (!charge) return;
  const gross = decimalToNumber(charge.amount) * charge.qty;
  let open =
    gross - charge.paymentAllocations.reduce((sum, row) => sum + decimalToNumber(row.amount), 0);
  if (open <= 0.009) return;

  const payments = await prisma.folioPayment.findMany({
    where: {
      folioId,
      kind: 'PAYMENT',
      voidedAt: null,
      revenueCodeId,
    },
    include: { allocations: true },
    orderBy: [{ businessDate: 'asc' }, { id: 'asc' }],
  });
  for (const payment of payments) {
    if (open <= 0.009) break;
    const used = payment.allocations.reduce((sum, row) => sum + decimalToNumber(row.amount), 0);
    const leftover = decimalToNumber(payment.amount) - used;
    if (leftover <= 0.009) continue;
    const take = Math.min(open, leftover);
    await prisma.folioPaymentAllocation.create({
      data: {
        paymentId: payment.id,
        chargeId,
        amount: toDecimal(Math.round(take * 100) / 100),
      },
    });
    open -= take;
  }
}

export async function postPayment(input: {
  folioId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  registerRef?: string;
  bankReference?: string;
  bankTerminalId?: string;
  createdByUserId?: string;
  kind?: 'PAYMENT' | 'REFUND';
  refundOfPaymentId?: string;
  refundReason?: string;
  revenueCodeId?: string;
  auditRequest?: Request;
  /** Finance City Ledger apply-back already passed hotel AR handoff — do not re-gate. */
  skipCityLedgerGate?: boolean;
}) {
  const folio = await prisma.folio.findUnique({
    where: { id: input.folioId },
    include: { reservation: { include: { guest: true } } },
  });
  if (!folio) throw new Error('Folio not found');
  const kind = input.kind ?? 'PAYMENT';
  if (
    kind === 'PAYMENT' &&
    input.revenueCodeId &&
    input.paymentMethod !== 'GUEST_DEBT' &&
    input.paymentMethod !== 'CL_AGENCY' &&
    input.paymentMethod !== 'CL_COMPANY'
  ) {
    const lines = await prisma.folio.findUnique({
      where: { id: input.folioId },
      include: { charges: true, payments: true },
    });
    const articleDebt = stayMoneyPair(
      (lines?.charges ?? []).filter((row) => row.revenueCodeId === input.revenueCodeId),
      (lines?.payments ?? []).filter((row) => row.revenueCodeId === input.revenueCodeId),
    ).debt;
    if (articleDebt > 0.01 && input.amount > articleDebt + 0.01) {
      throw new Error(`PAYMENT_EXCEEDS_ARTICLE:${articleDebt.toFixed(2)}`);
    }
  }
  if (
    kind === 'PAYMENT' &&
    !input.skipCityLedgerGate &&
    (input.paymentMethod === 'CL_AGENCY' ||
      input.paymentMethod === 'CL_COMPANY' ||
      input.paymentMethod === 'COMPANY_ACCOUNT')
  ) {
    const { assertCanPostCityLedgerTender } = await import('@/lib/services/city-ledger-gate.service');
    await assertCanPostCityLedgerTender(folio.reservationId, input.paymentMethod, input.amount);
  }
  if (folio.status !== 'OPEN' && !(kind === 'REFUND' && ['CLOSED', 'PENDING_AR'].includes(folio.status))) {
    throw new Error('Folio is not open');
  }
  if (kind === 'REFUND' && folio.status === 'TRANSFERRED_AR') {
    throw new Error('Cannot refund on TRANSFERRED_AR folio — reverse in Finance first');
  }

  let fiscalReceiptId: string | null = null;
  let fiscalQrPayload: string | null = null;
  const liveFiscal = process.env.ERA_FISCAL_LIVE === "true";
  const orgId = requestOrganizationId();

  const cardTender =
    input.paymentMethod === 'CARD' || input.paymentMethod.startsWith('CARD_');
  if (kind === 'PAYMENT' && cardTender) {
    const { ensureFiscalDevices } = await import('@/lib/fiscal-device-mirror');
    await ensureFiscalDevices(orgId);
    const { listDevicesForSatellite } = await import('@era/satellite-kit');
    const terminals = listDevicesForSatellite({ organizationId: orgId, kind: 'BANK_POS' });
    if (terminals.length > 0 && !input.bankTerminalId?.trim()) {
      throw new Error('BANK_TERMINAL_REQUIRED');
    }
  }

  if (kind === 'PAYMENT' && ['CASH', 'CARD'].includes(input.paymentMethod)) {
    const { fiscalizeForSatellite, isFiscalSkipped } = await import('@era/satellite-kit');
    try {
      const cashShift = await prisma.cashShift.findFirst({
        where: { status: 'OPEN' },
        orderBy: { openedAt: 'desc' },
      });
      const receipt = await fiscalizeForSatellite(
        {
          documentRef: input.folioId,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          registerRef: input.registerRef,
          organizationId: orgId,
          fiscalDeviceId: cashShift?.fiscalDeviceId ?? undefined,
          bankTerminalId: input.bankTerminalId?.trim() || cashShift?.bankTerminalId || undefined,
          shiftFiscalDeviceId: cashShift?.fiscalDeviceId ?? undefined,
          shiftBankTerminalId: cashShift?.bankTerminalId ?? undefined,
          lines: [
            {
              name: `Folio ${input.folioId.slice(0, 8)}`,
              qty: 1,
              unitPrice: input.amount,
            },
          ],
        },
        orgId,
      );
      if (!isFiscalSkipped(receipt)) {
        fiscalReceiptId = receipt.receiptId;
        fiscalQrPayload = receipt.qrPayload;
      }
    } catch (e) {
      console.error('KKM fiscalize failed', e);
      if (liveFiscal || (e instanceof Error && e.name === 'FiscalError')) throw e;
    }
  }

  if (kind === 'REFUND' && ['CASH', 'CARD'].includes(input.paymentMethod)) {
    const { refundForSatelliteRouted, isFiscalSkipped } = await import('@era/satellite-kit');
    try {
      const original = input.refundOfPaymentId
        ? await prisma.folioPayment.findUnique({ where: { id: input.refundOfPaymentId } })
        : null;
      if (original?.fiscalReceiptId) {
        const cashShift = await prisma.cashShift.findFirst({
          where: { status: 'OPEN' },
          orderBy: { openedAt: 'desc' },
        });
        const refunded = await refundForSatelliteRouted({
          organizationId: orgId,
          documentRef: `refund:${input.folioId}:${original.id}`,
          originalReceiptId: original.fiscalReceiptId,
          amount: input.amount,
          fiscalDeviceId: cashShift?.fiscalDeviceId ?? undefined,
          shiftFiscalDeviceId: cashShift?.fiscalDeviceId ?? undefined,
          reason: input.refundReason,
        });
        if (!isFiscalSkipped(refunded)) {
          fiscalReceiptId = refunded.receiptId;
          fiscalQrPayload = refunded.qrPayload;
        }
      }
    } catch (e) {
      console.error('KKM refund failed', e);
      if (liveFiscal || (e instanceof Error && e.name === 'FiscalError')) throw e;
    }
  }

  if (folio.status !== 'OPEN' && kind === 'REFUND') {
    await prisma.folio.update({ where: { id: folio.id }, data: { status: 'OPEN' } });
  }

  const businessDate = await getCurrentBusinessDate();
  const { assertYearBoundaryAllows } = await import('@/lib/services/year-boundary.service');
  await assertYearBoundaryAllows(businessDate);
  const payment = await prisma.folioPayment.create({
    data: {
      folioId: input.folioId,
      amount: toDecimal(input.amount),
      paymentMethod: input.paymentMethod,
      kind,
      refundOfPaymentId: input.refundOfPaymentId,
      refundReason: input.refundReason,
      registerRef: input.registerRef,
      bankReference: input.bankReference,
      bankTerminalId: input.bankTerminalId,
      createdByUserId: input.createdByUserId ?? null,
      businessDate,
      fiscalReceiptId,
      fiscalQrPayload,
      revenueCodeId: input.revenueCodeId ?? null,
    },
  });

  if (kind === 'PAYMENT' && (input.paymentMethod === 'CL_AGENCY' || input.paymentMethod === 'CL_COMPANY')) {
    await mirrorCityLedgerCharge({
      reservationId: folio.reservationId,
      method: input.paymentMethod,
      amount: input.amount,
      businessDate: payment.businessDate,
      sourcePaymentId: payment.id,
      sourceFolioId: folio.id,
    });
  }

  if (kind === 'PAYMENT') {
    await allocatePaymentToCharges(input.folioId, payment.id, input.amount, input.revenueCodeId);
  }

  await recalcReservationTotal(folio.reservationId);
  fireAndForgetDispatch(dispatchFolioPaymentReceived(payment.id));
  if (fiscalReceiptId) {
    const { dispatchPaymentFiscalized } = await import('@/lib/integration/event-dispatcher');
    fireAndForgetDispatch(
      dispatchPaymentFiscalized({
        paymentId: payment.id,
        folioId: input.folioId,
        reservationId: folio.reservationId,
        amount: input.amount,
        receiptId: fiscalReceiptId,
        qrPayload: fiscalQrPayload,
      }),
    );
  }

  const organizationId = requestOrganizationId();
  if (organizationId && input.amount > 0 && kind === 'PAYMENT') {
    const { runHotelFolioPlatformHooks } = await import(
      '@/lib/integration/platform-commerce'
    );
    void runHotelFolioPlatformHooks({
      folioId: input.folioId,
      amountAzn: input.amount,
      sourceEntityType: 'folio_payment',
      sourceEntityId: payment.id,
      description: `Folio payment ${input.paymentMethod}`,
      guestPhone: folio.reservation.guest.phone,
    }).catch((e) => console.error('Platform hooks on folio payment failed', e));
  }

  if (input.paymentMethod !== 'GUEST_DEBT') {
    const { recordReservationAudit } = await import('@/lib/reservation-audit');
    await recordReservationAudit(folio.reservationId, kind === 'REFUND' ? 'REFUND' : 'PAYMENT', {
      userId: input.createdByUserId,
      request: input.auditRequest,
    }, {
      section: 'folio',
      source: 'user',
      fields: [
        { key: 'amount', from: null, to: String(input.amount) },
        { key: 'paymentMethod', from: null, to: input.paymentMethod },
        ...(input.bankTerminalId ? [{ key: 'bankTerminalId', from: null, to: input.bankTerminalId }] : []),
        ...(input.refundReason ? [{ key: 'reason', from: null, to: input.refundReason }] : []),
      ],
      refs: { paymentId: payment.id, folioId: input.folioId },
    });
  }
  return payment;
}

async function mirrorCityLedgerCharge(input: {
  reservationId: string;
  method: 'CL_AGENCY' | 'CL_COMPANY';
  amount: number;
  businessDate: Date;
  sourcePaymentId?: string;
  sourceFolioId?: string;
}) {
  const type = input.method === 'CL_AGENCY' ? 'AGENCY' : 'COMPANY';
  const organizationId = requestOrganizationId();
  const existing = await prisma.folio.findFirst({
    where: { reservationId: input.reservationId, type, status: 'OPEN' },
  });
  const target =
    existing ??
    (await prisma.folio.create({
      data: {
        organizationId,
        reservationId: input.reservationId,
        type,
        status: 'OPEN',
      },
    }));
  const revenue = await requireRevenueCodeByRole('ROOM');
  const refs = [
    input.sourcePaymentId ? `payment:${input.sourcePaymentId}` : null,
    input.sourceFolioId ? `fromFolio:${input.sourceFolioId}` : null,
  ]
    .filter(Boolean)
    .join(' ');
  const description =
    (input.method === 'CL_AGENCY' ? 'City ledger agency' : 'City ledger company') +
    (refs ? ` (${refs})` : '');
  await prisma.folioCharge.create({
    data: {
      organizationId,
      folioId: target.id,
      revenueCodeId: revenue.id,
      amount: toDecimal(input.amount),
      qty: 1,
      description,
      businessDate: input.businessDate,
    },
  });
}

/** Take a posted payment off the live folio. The row stays for the Deleted tab and the voids report. */
export async function voidFolioPayment(input: {
  paymentId: string;
  reason: string;
  audit?: { userId?: string | null; request?: Request };
}) {
  const reason = input.reason.trim();
  if (!reason) throw new Error('A reason is required');
  const payment = await prisma.folioPayment.findUnique({
    where: { id: input.paymentId },
    include: { folio: true },
  });
  if (!payment) throw new Error('Payment not found');
  if (payment.voidedAt) throw new Error('Payment is already deleted');
  if (payment.kind !== 'PAYMENT' && payment.kind !== 'REFUND') {
    throw new Error('Only a posted payment can be deleted');
  }
  if (payment.kind === 'REFUND' && payment.fiscalReceiptId) {
    throw new Error('FISCAL_RECEIPT_VOID_BLOCKED');
  }
  if (payment.folio.status === 'TRANSFERRED_AR') {
    throw new Error('Cannot delete a payment after City Ledger transfer');
  }
  const updated = await prisma.folioPayment.update({
    where: { id: payment.id },
    data: { voidedAt: new Date(), voidReason: reason },
  });
  await prisma.folioPaymentAllocation.deleteMany({ where: { paymentId: payment.id } });
  await recalcReservationTotal(payment.folio.reservationId);
  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  await recordReservationAudit(payment.folio.reservationId, 'PAYMENT_VOID', input.audit, {
    section: 'folio',
    source: 'user',
    fields: [
      { key: 'amount', from: String(payment.amount), to: null },
      { key: 'reason', from: null, to: reason },
    ],
    refs: { paymentId: payment.id, folioId: payment.folioId },
  });
  return updated;
}

export async function listVoidedFolioPayments() {
  return prisma.folioPayment.findMany({
    where: { voidedAt: { not: null } },
    orderBy: { voidedAt: 'desc' },
    take: 500,
    include: {
      folio: {
        select: {
          id: true,
          type: true,
          reservationId: true,
          reservation: {
            select: {
              id: true,
              room: { select: { roomNumber: true } },
              guest: { select: { fullName: true } },
            },
          },
        },
      },
    },
  });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function listGuestDebtJournal() {
  const rows = await prisma.guestDebtEntry.findMany({
    orderBy: { createdAt: 'desc' },
    include: { payments: { select: { amount: true } } },
  });
  const guestIds = [...new Set(rows.map((row) => row.guestId))];
  const reservationIds = [...new Set(rows.map((row) => row.reservationId))];
  const userIds = [...new Set(rows.map((row) => row.createdByUserId).filter((id): id is string => Boolean(id)))];
  const [guests, reservations, users] = await Promise.all([
    guestIds.length
      ? prisma.guest.findMany({ where: { id: { in: guestIds } }, select: { id: true, fullName: true } })
      : [],
    reservationIds.length
      ? prisma.reservation.findMany({
          where: { id: { in: reservationIds } },
          select: { id: true, room: { select: { roomNumber: true } } },
        })
      : [],
    userIds.length
      ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } })
      : [],
  ]);
  const guestName = new Map(guests.map((guest) => [guest.id, guest.fullName]));
  const roomNumber = new Map(reservations.map((stay) => [stay.id, stay.room?.roomNumber ?? null]));
  const actor = new Map(users.map((user) => [user.id, user.fullName]));
  return rows.map((row) => {
    const amount = decimalToNumber(row.amount);
    const paid = round2(row.payments.reduce((sum, payment) => sum + decimalToNumber(payment.amount), 0));
    return {
      id: row.id,
      createdAt: row.createdAt,
      amount,
      paid,
      remaining: round2(amount - paid),
      note: row.note,
      reservationId: row.reservationId,
      guestName: guestName.get(row.guestId) ?? null,
      roomNumber: roomNumber.get(row.reservationId) ?? null,
      actor: row.createdByUserId ? actor.get(row.createdByUserId) ?? null : null,
    };
  });
}

const GUEST_DEBT_PAY_METHODS = new Set<PaymentMethod>(['CASH', 'CARD', 'BANK_TRANSFER']);

/** Take money against a personal debt left at checkout. Does not reopen the folio. */
export async function payGuestDebt(input: {
  entryId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  bankTerminalId?: string | null;
  createdByUserId?: string | null;
  auditRequest?: Request;
}) {
  if (!GUEST_DEBT_PAY_METHODS.has(input.paymentMethod)) {
    throw new Error('Payment method is not accepted for a guest debt');
  }
  const amount = round2(input.amount);
  if (!(amount > 0)) throw new Error('Amount must be positive');
  if (input.paymentMethod === 'CARD' && !input.bankTerminalId) {
    throw new Error('Card payment needs a terminal');
  }
  const organizationId = requestOrganizationId();
  const paid = await prisma.$transaction(async (tx) => {
    const entry = await tx.guestDebtEntry.findFirst({
      where: { id: input.entryId, organizationId },
      include: { payments: { select: { amount: true } } },
    });
    if (!entry) throw new Error('Guest debt not found');
    const already = entry.payments.reduce(
      (sum: number, row: { amount: Parameters<typeof decimalToNumber>[0] }) =>
        sum + decimalToNumber(row.amount),
      0,
    );
    const remaining = round2(decimalToNumber(entry.amount) - already);
    if (amount - remaining > 0.001) throw new Error('Amount is above the remaining debt');
    const businessDate = await getCurrentBusinessDate();
    const { assertYearBoundaryAllows } = await import('@/lib/services/year-boundary.service');
    await assertYearBoundaryAllows(businessDate);
    const payment = await tx.guestDebtPayment.create({
      data: {
        organizationId: entry.organizationId,
        entryId: entry.id,
        amount: toDecimal(amount),
        paymentMethod: input.paymentMethod,
        bankTerminalId: input.paymentMethod === 'CARD' ? input.bankTerminalId ?? null : null,
        createdByUserId: input.createdByUserId ?? null,
        businessDate,
      },
    });
    return {
      id: payment.id,
      reservationId: entry.reservationId,
      bankTerminalId: payment.bankTerminalId,
      remaining: round2(remaining - amount),
    };
  }, { isolationLevel: 'Serializable' });
  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  await recordReservationAudit(paid.reservationId, 'GUEST_DEBT_PAY', {
    userId: input.createdByUserId,
    request: input.auditRequest,
  }, {
    section: 'folio',
    source: 'user',
    fields: [
      { key: 'amount', from: null, to: String(amount) },
      { key: 'paymentMethod', from: null, to: input.paymentMethod },
      { key: 'remaining', from: null, to: String(paid.remaining) },
    ],
    refs: { entryId: input.entryId, paymentId: paid.id },
  });
  return { id: paid.id, remaining: paid.remaining };
}

async function recalcReservationTotal(reservationId: string) {
  const rates = await prisma.reservationDailyRate.findMany({
    where: { reservationId },
    select: { amount: true },
  });
  if (rates.length === 0) return;
  const total = rates.reduce((sum, row) => sum + decimalToNumber(row.amount), 0);
  await prisma.reservation.update({
    where: { id: reservationId },
    data: { totalAmount: toDecimal(Math.max(0, total)) },
  });
}

export async function getReservationFolioBalances(reservationId: string) {
  const folios = await prisma.folio.findMany({
    where: { reservationId, status: 'OPEN' },
    include: { charges: true, payments: true },
  });
  return folios.map((f) => ({
    folioId: f.id,
    type: f.type,
    balance: folioBalance(f.charges, f.payments),
  }));
}

/** Guest OPEN folios must be zero; COMPANY/AGENCY may transfer when allowed. */
export async function assertGuestFoliosZeroBalance(reservationId: string) {
  const balances = await getReservationFolioBalances(reservationId);
  const guestTotal = balances
    .filter((b) => b.type === 'GUEST')
    .reduce((s, b) => s + b.balance, 0);
  if (Math.abs(guestTotal) > 0.01) {
    throw new Error(`Outstanding guest folio balance: ${guestTotal.toFixed(2)} AZN`);
  }
}

export async function assertZeroBalance(reservationId: string) {
  const balances = await getReservationFolioBalances(reservationId);
  const total = balances.reduce((s, b) => s + b.balance, 0);
  if (Math.abs(total) > 0.01) {
    throw new Error(`Outstanding folio balance: ${total.toFixed(2)} AZN`);
  }
}

export async function closeFolios(
  reservationId: string,
  opts?: { onlyTypes?: Array<'GUEST' | 'COMPANY' | 'AGENCY'>; targetStatus?: 'CLOSED' | 'PENDING_AR' },
) {
  const targetStatus = opts?.targetStatus ?? 'CLOSED';
  await prisma.folio.updateMany({
    where: {
      reservationId,
      status: 'OPEN',
      ...(opts?.onlyTypes ? { type: { in: opts.onlyTypes } } : {}),
    },
    data: { status: targetStatus },
  });
}

export async function closeFolio(folioId: string) {
  const folio = await prisma.folio.findUnique({
    where: { id: folioId },
    include: { charges: true, payments: true },
  });
  if (!folio) throw new Error('Folio not found');
  if (folio.status !== 'OPEN') throw new Error('Folio is not open');
  const bal = folioBalance(folio.charges, folio.payments);
  if (Math.abs(bal) > 0.01) {
    throw new Error(`Cannot close folio with balance ${bal.toFixed(2)} AZN`);
  }
  return prisma.folio.update({ where: { id: folioId }, data: { status: 'CLOSED' } });
}

export async function postDiscount(input: {
  reservationId: string;
  amount: number;
  description: string;
  folioId?: string;
  audit?: { userId?: string | null; request?: Request; source?: 'user' | 'elektraweb' | 'night_audit' | 'system' };
}) {
  if (input.amount <= 0) throw new Error('Discount amount must be positive');
  const code = await requireRevenueCodeByRole('DISCOUNT');
  return postCharge({
    reservationId: input.reservationId,
    revenueCodeId: code.id,
    amount: -Math.abs(input.amount),
    qty: 1,
    stockQty: 0,
    description: input.description || 'Discount',
    audit: input.audit,
  });
}

/** Counter-line on the same folio. The source charge is left as posted. */
export async function postFolioAdjustment(input: {
  chargeId: string;
  amount: number;
  reason: string;
  audit?: { userId?: string | null; request?: Request };
}) {
  const reason = input.reason.trim();
  if (!reason) throw new Error('A reason is required');
  const amount = Math.round(input.amount * 100) / 100;
  if (!Number.isFinite(amount) || amount === 0) throw new Error('Amount must be non-zero');
  const source = await prisma.folioCharge.findUnique({
    where: { id: input.chargeId },
    include: { folio: true },
  });
  if (!source) throw new Error('Charge not found');
  if (source.folio.status !== 'OPEN') throw new Error('Folio is not open');
  const { assertBusinessDayOpenForPosting } = await import('@/lib/services/business-date.service');
  await assertBusinessDayOpenForPosting();
  const revenue = await requireRevenueCodeByRole('RATE_ADJ');
  const businessDate = await getCurrentBusinessDate();
  const charge = await prisma.folioCharge.create({
    data: {
      organizationId: source.organizationId,
      folioId: source.folioId,
      revenueCodeId: revenue.id,
      amount: toDecimal(amount),
      qty: 1,
      stockQty: 0,
      description: reason,
      businessDate,
      adjustsChargeId: source.id,
      adjustmentReason: reason,
      externalRef: `folio-adj:${source.id}:${crypto.randomUUID()}`,
    },
  });
  await recalcReservationTotal(source.folio.reservationId);
  fireAndForgetDispatch(dispatchFolioChargePosted(charge.id));
  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  await recordReservationAudit(source.folio.reservationId, 'CHARGE', input.audit, {
    section: 'folio',
    source: 'user',
    fields: [
      { key: 'amount', from: null, to: String(amount) },
      { key: 'reason', from: null, to: reason },
      { key: 'adjustsChargeId', from: null, to: source.id },
    ],
  });
  return charge;
}

export async function voidCharge(
  chargeId: string,
  reason?: string,
  audit?: { userId?: string | null; request?: Request },
) {
  const voidReason = reason?.trim() ?? '';
  if (!voidReason) throw new Error('VOID_REASON_REQUIRED');
  const charge = await prisma.folioCharge.findUnique({
    where: { id: chargeId },
    include: {
      folio: { include: { reservation: { include: { guest: true } } } },
      revenueCode: true,
    },
  });
  if (!charge) throw new Error('Charge not found');
  if (charge.serviceReceivedAt) {
    throw new Error('Procedure already received — void refused');
  }
  if (charge.folio.status !== 'OPEN') throw new Error('Cannot void charge on closed folio');
  const { parseFolioChargeRef } = await import('@era/satellite-kit/integration/folio-charge-ref');
  const clinicCharge = parseFolioChargeRef(charge.externalRef);
  if (clinicCharge?.source === 'clinic') {
    const orderId = clinicCharge.orderId;
    const clinicBase = (
      process.env.CLINIC_URL ??
      process.env.ERA_CLINIC_URL ??
      ''
    ).replace(/\/$/, '');
    const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ?? '';
    if (clinicBase && token) {
      const res = await fetch(`${clinicBase}/api/internal/v1/extras/hotel-void`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          organizationId: charge.organizationId,
          externalTicketId: clinicCharge.ref,
          orderId,
        }),
      }).catch(() => null);
      if (res && res.ok) {
        const body = (await res.json()) as {
          reason?: string;
          data?: { reason?: string };
        };
        const reason = body.reason ?? body.data?.reason;
        if (reason === 'received') {
          throw new Error('Clinic refused the void — procedure already received');
        }
      }
    }
  }

  const { hotelDateKey } = await import('@/lib/hotel-calendar');
  const { bakuCivilUtcDate } = await import('@era/satellite-kit/time');
  const postedDay = await prisma.businessDay.findFirst({
    where: { date: bakuCivilUtcDate(hotelDateKey(charge.businessDate)) },
  });
  const housePair = charge.externalRef?.startsWith('house-use:')
    ? await prisma.folioCharge.findUnique({
        where: { id: charge.externalRef.slice('house-use:'.length) },
        include: { revenueCode: true },
      })
    : await prisma.folioCharge.findFirst({
        where: { externalRef: `house-use:${charge.id}`, folioId: charge.folioId },
        include: { revenueCode: true },
      });
  const targets = housePair && housePair.id !== charge.id ? [charge, housePair] : [charge];

  if (postedDay?.status === 'CLOSED') {
    const { assertBusinessDayOpenForPosting } = await import('@/lib/services/business-date.service');
    await assertBusinessDayOpenForPosting();
    const openDate = await getCurrentBusinessDate();
    for (const row of targets) {
      const already = await prisma.folioCharge.findFirst({
        where: { externalRef: `void-${row.id}` },
      });
      if (already) continue;
      await prisma.folioCharge.create({
        data: {
          folioId: row.folioId,
          revenueCodeId: row.revenueCodeId,
          departmentId: row.departmentId,
          amount: row.amount,
          qty: -row.qty,
          stockQty: -row.stockQty,
          warehouseCode: row.warehouseCode,
          sku: row.sku,
          description: `Void ${row.description} — ${voidReason}`,
          businessDate: openDate,
          externalRef: `void-${row.id}`,
        },
      });
    }
    await recalcReservationTotal(charge.folio.reservationId);
    const { recordReservationAudit } = await import('@/lib/reservation-audit');
    await recordReservationAudit(charge.folio.reservationId, 'VOID', audit, {
      section: 'folio',
      source: 'user',
      fields: [
        { key: 'amount', from: String(charge.amount), to: null },
        { key: 'revenueCode', from: charge.revenueCode.code, to: null },
        { key: 'reason', from: null, to: voidReason },
      ],
      refs: { chargeId: charge.id, folioId: charge.folioId },
    });
    return { reservationId: charge.folio.reservationId };
  }

  const voidPayload = {
    chargeId: charge.id,
    reservationId: charge.folio.reservationId,
    folioId: charge.folioId,
    folioType: charge.folio.type,
    revenueCode: charge.revenueCode.code,
    amount: decimalToNumber(charge.amount),
    qty: charge.qty,
    description: charge.description,
    businessDate: charge.businessDate,
  };

  await prisma.folioCharge.delete({ where: { id: chargeId } });
  if (housePair && housePair.id !== charge.id) {
    await prisma.folioCharge.delete({ where: { id: housePair.id } });
    fireAndForgetDispatch(
      dispatchFolioChargeVoided({
        ...voidPayload,
        chargeId: housePair.id,
        revenueCode: housePair.revenueCode.code,
        amount: decimalToNumber(housePair.amount),
        qty: housePair.qty,
        description: housePair.description ?? '',
      }),
    );
  }
  const { voidLaundryForCharge } = await import('@/lib/services/hk-nafta.service');
  await voidLaundryForCharge(chargeId);
  await recalcReservationTotal(charge.folio.reservationId);
  fireAndForgetDispatch(dispatchFolioChargeVoided(voidPayload));
  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  await recordReservationAudit(charge.folio.reservationId, 'VOID', audit, {
    section: 'folio',
    source: 'user',
    fields: [
      { key: 'amount', from: String(charge.amount), to: null },
      { key: 'revenueCode', from: charge.revenueCode.code, to: null },
      { key: 'reason', from: null, to: voidReason },
    ],
    refs: { chargeId: charge.id, folioId: charge.folioId },
  });
  return { reservationId: charge.folio.reservationId };
}

export async function listFolios(reservationId?: string) {
  return prisma.folio.findMany({
    where: reservationId ? { reservationId } : undefined,
    include: {
      charges: { include: { revenueCode: true, department: true, paymentAllocations: true } },
      payments: { include: { revenueCode: true } },
      fiscalDocuments: true,
      reservationGuest: { select: { firstName: true, lastName: true, guest: { select: { fullName: true } } } },
      reservation: {
        include: {
          guest: true,
          room: true,
          agency: { select: { id: true, name: true } },
          company: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
