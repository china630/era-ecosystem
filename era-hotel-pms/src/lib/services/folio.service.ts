import { shouldOffsetHouseUse } from '@/lib/stay-billing';
import { prisma } from '@/lib/prisma';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';
import { requestOrganizationId } from '@/lib/request-organization';
import { assertActiveForNewUse } from '@/lib/master-data/retire-policy';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { findRevenueCodeByToken } from '@/lib/revenue-code-token';
import type { FolioType, PaymentMethod } from '@prisma/client';
import {
  dispatchFolioChargePosted,
  dispatchFolioChargeVoided,
  dispatchFolioPaymentReceived,
} from '@/lib/integration/event-dispatcher';
import { parseRoomChargeNote, roomChargeNote } from '@/lib/folio-charge-note';
import { hotelDateKey } from '@/lib/hotel-calendar';

const ROOM_REVENUE_CODES = new Set(['ROOM', 'ACCOM', 'LODGING', 'STAY']);

function chargeDescriptionForPost(
  code: string,
  description: string,
  businessDate: Date,
): string {
  const trimmed = description.trim();
  if (!ROOM_REVENUE_CODES.has(code.trim().toUpperCase())) return trimmed;
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

export async function openFoliosForReservation(reservationId: string, guestVoen: string | null) {
  const existing = await prisma.folio.findMany({ where: { reservationId } });
  if (existing.length > 0) return existing;

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      agencyId: true,
      companyId: true,
      group: { select: { folioMode: true, agencyId: true } },
    },
  });

  const types: FolioType[] = guestVoen || reservation?.companyId ? ['GUEST', 'COMPANY'] : ['GUEST'];
  const needsAgency =
    Boolean(reservation?.agencyId || reservation?.group?.agencyId) &&
    (reservation?.group?.folioMode === 'MASTER' || reservation?.group?.folioMode === 'SPLIT' || Boolean(reservation?.agencyId));
  if (needsAgency && !types.includes('AGENCY')) types.push('AGENCY');

  return prisma.$transaction(
    types.map((type) =>
      prisma.folio.create({
        data: {
          organizationId: requestOrganizationId(),
          reservationId,
          type,
          status: 'OPEN',
        },
      }),
    ),
  );
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
  sku?: string | null;
  description: string;
  businessDate?: Date;
  departmentId?: string;
  externalRef?: string;
  invoiceRef?: string;
}) {
  const { assertBusinessDayOpenForPosting } = await import('@/lib/services/business-date.service');
  await assertBusinessDayOpenForPosting();

  const reservation = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    include: { folios: true, guest: true },
  });
  if (!reservation) throw new Error('Reservation not found');
  if (!['CONFIRMED', 'IN_HOUSE'].includes(reservation.status)) {
    throw new Error('Charges can only be posted to CONFIRMED or IN_HOUSE reservations');
  }

  const revenueCode = await prisma.revenueCode.findUnique({ where: { id: input.revenueCodeId } });
  if (!revenueCode) throw new Error('Revenue code not found');
  assertActiveForNewUse(`Revenue code ${revenueCode.code}`, revenueCode.active);

  const { resolveBookingChargeTarget, ensureOpenFolio } = await import(
    '@/lib/services/booking-folio.service'
  );
  const bookingTarget = await resolveBookingChargeTarget({
    reservationId: input.reservationId,
    revenueCodeId: input.revenueCodeId,
  });

  let chargeReservationId = input.reservationId;
  let targetType = await resolveTargetFolioType(
    input.revenueCodeId,
    reservation.guest.voen ? 'COMPANY' : 'GUEST',
    input.reservationId,
  );
  let folio = reservation.folios.find((f) => f.type === targetType && f.status === 'OPEN');

  if (bookingTarget) {
    chargeReservationId = bookingTarget.reservationId;
    targetType = bookingTarget.folioType;
    if (chargeReservationId === input.reservationId) {
      folio = reservation.folios.find((f) => f.type === targetType && f.status === 'OPEN');
      if (!folio) {
        folio = await ensureOpenFolio(chargeReservationId, targetType);
      }
    } else {
      folio = await ensureOpenFolio(chargeReservationId, targetType);
    }
  } else if (!folio) {
    folio = await prisma.folio.create({
      data: {
        organizationId: requestOrganizationId(),
        reservationId: input.reservationId,
        type: targetType,
        status: 'OPEN',
      },
    });
  }

  if (!folio) throw new Error('Open folio missing after ensure');

  const businessDate = input.businessDate ?? new Date();
  const description = chargeDescriptionForPost(revenueCode.code, input.description, businessDate);

  const charge = await prisma.folioCharge.create({
    data: {
      folioId: folio.id,
      revenueCodeId: input.revenueCodeId,
      departmentId: input.departmentId,
      amount: toDecimal(input.amount),
      qty: input.qty ?? 1,
      sku: input.sku?.trim() || null,
      description,
      businessDate,
      externalRef: input.externalRef,
      invoiceRef: input.invoiceRef,
    },
    include: { revenueCode: true, folio: true },
  });

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
        sku: input.sku?.trim() || null,
        description: `${description} (house use)`,
        businessDate: input.businessDate ?? new Date(),
        externalRef: `house-use:${charge.id}`,
      },
    });
    fireAndForgetDispatch(dispatchFolioChargePosted(offset.id));
  }
  fireAndForgetDispatch(dispatchFolioChargePosted(charge.id));
  return charge;
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
}) {
  const folio = await prisma.folio.findUnique({
    where: { id: input.folioId },
    include: { reservation: { include: { guest: true } } },
  });
  if (!folio) throw new Error('Folio not found');
  const kind = input.kind ?? 'PAYMENT';
  if (kind === 'PAYMENT' && (input.paymentMethod === 'CL_AGENCY' || input.paymentMethod === 'CL_COMPANY')) {
    await assertCityLedgerCounterparty(folio.reservationId, input.paymentMethod);
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
      businessDate: await getCurrentBusinessDate(),
      fiscalReceiptId,
      fiscalQrPayload,
    },
  });

  if (kind === 'PAYMENT' && (input.paymentMethod === 'CL_AGENCY' || input.paymentMethod === 'CL_COMPANY')) {
    await mirrorCityLedgerCharge({
      reservationId: folio.reservationId,
      method: input.paymentMethod,
      amount: input.amount,
      businessDate: payment.businessDate,
    });
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

  return payment;
}

async function assertCityLedgerCounterparty(
  reservationId: string,
  method: 'CL_AGENCY' | 'CL_COMPANY',
) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { agencyId: true, companyId: true },
  });
  if (method === 'CL_AGENCY' && !reservation?.agencyId) {
    throw new Error('Agency is not set on this stay');
  }
  if (method === 'CL_COMPANY' && !reservation?.companyId) {
    throw new Error('Company is not set on this stay');
  }
}

async function mirrorCityLedgerCharge(input: {
  reservationId: string;
  method: 'CL_AGENCY' | 'CL_COMPANY';
  amount: number;
  businessDate: Date;
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
  const revenue = await findRevenueCodeByToken('ROOM');
  if (!revenue) throw new Error('ROOM revenue code missing');
  await prisma.folioCharge.create({
    data: {
      organizationId,
      folioId: target.id,
      revenueCodeId: revenue.id,
      amount: toDecimal(input.amount),
      qty: 1,
      description: input.method === 'CL_AGENCY' ? 'City ledger agency' : 'City ledger company',
      businessDate: input.businessDate,
    },
  });
}

/** Take a posted payment off the live folio. The row stays for the Deleted tab and the voids report. */
export async function voidFolioPayment(input: { paymentId: string; reason: string }) {
  const reason = input.reason.trim();
  if (!reason) throw new Error('A reason is required');
  const payment = await prisma.folioPayment.findUnique({
    where: { id: input.paymentId },
    include: { folio: true },
  });
  if (!payment) throw new Error('Payment not found');
  if (payment.voidedAt) throw new Error('Payment is already deleted');
  if (payment.kind !== 'PAYMENT') throw new Error('Only a posted payment can be deleted');
  if (payment.folio.status === 'TRANSFERRED_AR') {
    throw new Error('Cannot delete a payment after City Ledger transfer');
  }
  const updated = await prisma.folioPayment.update({
    where: { id: payment.id },
    data: { voidedAt: new Date(), voidReason: reason },
  });
  await prisma.folioPaymentAllocation.deleteMany({ where: { paymentId: payment.id } });
  await recalcReservationTotal(payment.folio.reservationId);
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

export async function listGuestDebtJournal() {
  const rows = await prisma.guestDebtEntry.findMany({
    orderBy: { createdAt: 'desc' },
    take: 300,
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
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    amount: row.amount,
    note: row.note,
    reservationId: row.reservationId,
    guestName: guestName.get(row.guestId) ?? null,
    roomNumber: roomNumber.get(row.reservationId) ?? null,
    actor: row.createdByUserId ? actor.get(row.createdByUserId) ?? null : null,
  }));
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
}) {
  if (input.amount <= 0) throw new Error('Discount amount must be positive');
  let code = await findRevenueCodeByToken('DISCOUNT');
  if (!code) {
    code = await prisma.revenueCode.create({
      data: { code: 'DISCOUNT', name: 'Discount', active: true },
    });
  }
  if (!code) throw new Error('DISCOUNT revenue code missing');
  return postCharge({
    reservationId: input.reservationId,
    revenueCodeId: code.id,
    amount: -Math.abs(input.amount),
    qty: 1,
    description: input.description || 'Discount',
  });
}

export async function voidCharge(chargeId: string, reason?: string) {
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
  if (charge.externalRef?.startsWith('pay-clinic-ticket-')) {
    const orderId = charge.externalRef.slice('pay-clinic-ticket-'.length).replace(/^pay-/, '');
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
          organizationId: charge.invoiceRef?.trim() || charge.organizationId,
          externalTicketId: charge.externalRef.replace(/^pay-/, ''),
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
          sku: row.sku,
          description: `Void ${row.description} — ${voidReason}`,
          businessDate: openDate,
          externalRef: `void-${row.id}`,
        },
      });
    }
    await recalcReservationTotal(charge.folio.reservationId);
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
    guestVoen: charge.folio.reservation.guest.voen,
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
  return { reservationId: charge.folio.reservationId };
}

export async function listFolios(reservationId?: string) {
  return prisma.folio.findMany({
    where: reservationId ? { reservationId } : undefined,
    include: {
      charges: { include: { revenueCode: true, department: true, paymentAllocations: true } },
      payments: true,
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
