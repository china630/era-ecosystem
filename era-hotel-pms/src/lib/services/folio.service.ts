import { prisma } from '@/lib/prisma';
import { satelliteOrganizationId } from '@era/satellite-kit/orchestrator-gateway';
import { assertActiveForNewUse } from '@/lib/master-data/retire-policy';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import type { FolioType, PaymentMethod } from '@prisma/client';
import {
  dispatchFolioChargePosted,
  dispatchFolioChargeVoided,
  dispatchFolioPaymentReceived,
} from '@/lib/integration/event-dispatcher';

function fireAndForgetDispatch(promise: Promise<unknown>) {
  promise.catch((err) => console.error('Outbound dispatch failed', err));
}

export function folioBalance(
  charges: { amount: { toNumber(): number }; qty: number }[],
  payments: { amount: { toNumber(): number }; kind?: string | null }[],
) {
  const chargeSum = charges.reduce((s, c) => s + decimalToNumber(c.amount) * c.qty, 0);
  const paySum = payments.reduce((s, p) => {
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
      group: { select: { folioMode: true, agencyId: true } },
    },
  });

  const types: FolioType[] = guestVoen ? ['GUEST', 'COMPANY'] : ['GUEST'];
  const needsAgency =
    Boolean(reservation?.agencyId || reservation?.group?.agencyId) &&
    (reservation?.group?.folioMode === 'MASTER' || reservation?.group?.folioMode === 'SPLIT');
  if (needsAgency && !types.includes('AGENCY')) types.push('AGENCY');

  return prisma.$transaction(
    types.map((type) =>
      prisma.folio.create({
        data: {
          organizationId: satelliteOrganizationId(),
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
  description: string;
  businessDate?: Date;
  departmentId?: string;
  externalRef?: string;
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
        organizationId: satelliteOrganizationId(),
        reservationId: input.reservationId,
        type: targetType,
        status: 'OPEN',
      },
    });
  }

  if (!folio) throw new Error('Open folio missing after ensure');

  const charge = await prisma.folioCharge.create({
    data: {
      folioId: folio.id,
      revenueCodeId: input.revenueCodeId,
      departmentId: input.departmentId,
      amount: toDecimal(input.amount),
      qty: input.qty ?? 1,
      description: input.description,
      businessDate: input.businessDate ?? new Date(),
      externalRef: input.externalRef,
    },
    include: { revenueCode: true, folio: true },
  });

  await recalcReservationTotal(chargeReservationId);
  if (chargeReservationId !== input.reservationId) {
    await recalcReservationTotal(input.reservationId);
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
  if (folio.status !== 'OPEN' && !(kind === 'REFUND' && ['CLOSED', 'PENDING_AR'].includes(folio.status))) {
    throw new Error('Folio is not open');
  }
  if (kind === 'REFUND' && folio.status === 'TRANSFERRED_AR') {
    throw new Error('Cannot refund on TRANSFERRED_AR folio — reverse in Finance first');
  }

  let fiscalReceiptId: string | null = null;
  let fiscalQrPayload: string | null = null;

  if (kind === 'PAYMENT' && ['CASH', 'CARD'].includes(input.paymentMethod)) {
    const { fiscalize } = await import('@era/fiscal');
    try {
      const receipt = await fiscalize({
        documentRef: input.folioId,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        registerRef: input.registerRef,
      });
      fiscalReceiptId = receipt.receiptId;
      fiscalQrPayload = receipt.qrPayload;
    } catch (e) {
      console.error('KKM fiscalize failed', e);
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
      fiscalReceiptId,
      fiscalQrPayload,
    },
  });

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

  const organizationId = satelliteOrganizationId();
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

async function recalcReservationTotal(reservationId: string) {
  const folios = await prisma.folio.findMany({
    where: { reservationId, status: { not: 'VOID' } },
    include: { charges: true, payments: true },
  });
  let total = 0;
  for (const f of folios) {
    total += folioBalance(f.charges, f.payments);
  }
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
  let code = await prisma.revenueCode.findFirst({ where: { code: 'DISCOUNT' } });
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

export async function voidCharge(chargeId: string) {
  const charge = await prisma.folioCharge.findUnique({
    where: { id: chargeId },
    include: {
      folio: { include: { reservation: { include: { guest: true } } } },
      revenueCode: true,
    },
  });
  if (!charge) throw new Error('Charge not found');
  if (charge.folio.status !== 'OPEN') throw new Error('Cannot void charge on closed folio');

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
      charges: { include: { revenueCode: true, department: true } },
      payments: true,
      fiscalDocuments: true,
      reservation: { include: { guest: true, room: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
