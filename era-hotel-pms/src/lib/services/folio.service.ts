import { prisma } from '@/lib/prisma';
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

export function folioBalance(charges: { amount: { toNumber(): number }; qty: number }[], payments: { amount: { toNumber(): number } }[]) {
  const chargeSum = charges.reduce((s, c) => s + decimalToNumber(c.amount) * c.qty, 0);
  const paySum = payments.reduce((s, p) => s + decimalToNumber(p.amount), 0);
  return chargeSum - paySum;
}

export async function openFoliosForReservation(reservationId: string, guestVoen: string | null) {
  const existing = await prisma.folio.findMany({ where: { reservationId } });
  if (existing.length > 0) return existing;

  const types: FolioType[] = guestVoen ? ['GUEST', 'COMPANY'] : ['GUEST'];
  return prisma.$transaction(
    types.map((type) =>
      prisma.folio.create({ data: { reservationId, type, status: 'OPEN' } }),
    ),
  );
}

export async function resolveTargetFolioType(revenueCodeId: string, defaultType: FolioType = 'GUEST'): Promise<FolioType> {
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
}) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    include: { folios: true, guest: true },
  });
  if (!reservation) throw new Error('Reservation not found');
  if (!['CONFIRMED', 'IN_HOUSE'].includes(reservation.status)) {
    throw new Error('Charges can only be posted to CONFIRMED or IN_HOUSE reservations');
  }

  const targetType = await resolveTargetFolioType(
    input.revenueCodeId,
    reservation.guest.voen ? 'COMPANY' : 'GUEST',
  );
  let folio = reservation.folios.find((f) => f.type === targetType && f.status === 'OPEN');
  if (!folio) {
    folio = await prisma.folio.create({
      data: { reservationId: input.reservationId, type: targetType, status: 'OPEN' },
    });
  }

  const charge = await prisma.folioCharge.create({
    data: {
      folioId: folio.id,
      revenueCodeId: input.revenueCodeId,
      departmentId: input.departmentId,
      amount: toDecimal(input.amount),
      qty: input.qty ?? 1,
      description: input.description,
      businessDate: input.businessDate ?? new Date(),
    },
    include: { revenueCode: true, folio: true },
  });

  await recalcReservationTotal(input.reservationId);
  fireAndForgetDispatch(dispatchFolioChargePosted(charge.id));
  return charge;
}

export async function postPayment(input: {
  folioId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  registerRef?: string;
}) {
  const folio = await prisma.folio.findUnique({
    where: { id: input.folioId },
    include: { reservation: true },
  });
  if (!folio) throw new Error('Folio not found');
  if (folio.status !== 'OPEN') throw new Error('Folio is not open');

  let fiscalReceiptId: string | null = null;
  let fiscalQrPayload: string | null = null;

  if (['CASH', 'CARD'].includes(input.paymentMethod)) {
    const { getFiscalProvider } = await import('@/lib/compliance/fiscal-provider');
    const { dispatchPaymentFiscalized } = await import('@/lib/integration/event-dispatcher');
    try {
      const receipt = await getFiscalProvider().fiscalizePayment({
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

  const payment = await prisma.folioPayment.create({
    data: {
      folioId: input.folioId,
      amount: toDecimal(input.amount),
      paymentMethod: input.paymentMethod,
      registerRef: input.registerRef,
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

export async function assertZeroBalance(reservationId: string) {
  const balances = await getReservationFolioBalances(reservationId);
  const total = balances.reduce((s, b) => s + b.balance, 0);
  if (Math.abs(total) > 0.01) {
    throw new Error(`Outstanding folio balance: ${total.toFixed(2)} AZN`);
  }
}

export async function closeFolios(reservationId: string) {
  await prisma.folio.updateMany({
    where: { reservationId, status: 'OPEN' },
    data: { status: 'CLOSED' },
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
